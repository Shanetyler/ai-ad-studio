import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEEP_SCAN_CREDIT_COST } from "@/lib/ad-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PROFILE_COLUMNS =
  "id, website_url, depth, status, pages_scanned, profile_json, brief_json, provenance_json, assets_json, brand_id, error, confirmed_at, created_at";

async function consume(ctx: any, userId: string, amount: number, reason: string, jobId?: string) {
  const { error } = await ctx.supabase.rpc("consume_credits", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _job_id: jobId ?? null,
  });
  if (error) {
    if (error.message.includes("INSUFFICIENT_CREDITS")) {
      throw new Error("Not enough credits for a deep scan. Top up to continue.");
    }
    throw new Error(error.message);
  }
}

/**
 * Deep website intelligence. Crawls the most relevant same-origin pages, extracts
 * hard facts, then consolidates them into a business profile + creative brief.
 * A quick scan reads the landing page only and is free.
 */
export const scanWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        url: z.string().min(4).max(2048),
        depth: z.enum(["quick", "deep"]).default("deep"),
        brandId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { crawlSinglePage, crawlSite, isSafePublicUrl } = await import("./research/crawl.server");
    const { crawlSiteWithFirecrawl, firecrawlAvailable } = await import("./research/firecrawl.server");
    const { buildProfile } = await import("./research/profile.server");

    const normalized = /^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`;
    const safe = isSafePublicUrl(normalized);
    if (!safe.ok || !safe.url) throw new Error(safe.reason ?? "That URL cannot be scanned.");
    const websiteUrl = safe.url.toString();


    const { data: profileRow, error: pErr } = await supabase
      .from("business_profiles")
      .insert({
        owner_id: userId,
        brand_id: data.brandId ?? null,
        website_url: websiteUrl,
        depth: data.depth,
        status: "scanning",
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    const profileId = profileRow.id as string;

    const { data: job } = await supabase
      .from("jobs")
      .insert({
        owner_id: userId,
        kind: "brand_research",
        status: "running",
        cost_credits: data.depth === "deep" ? DEEP_SCAN_CREDIT_COST : 0,
        started_at: new Date().toISOString(),
        input_json: { website_url: websiteUrl, depth: data.depth, profile_id: profileId },
      })
      .select("id")
      .single();

    if (data.depth === "deep") {
      try {
        await consume(context, userId, DEEP_SCAN_CREDIT_COST, "deep_scan", job?.id);
      } catch (err) {
        await supabase.from("business_profiles").update({ status: "failed", error: String(err).slice(0, 400) }).eq("id", profileId);
        if (job) await supabase.from("jobs").update({ status: "failed", error: String(err).slice(0, 400) }).eq("id", job.id);
        throw err;
      }
    }

    let crawler: "firecrawl" | "builtin" = "builtin";
    try {
      let crawl;
      if (data.depth === "deep") {
        if (firecrawlAvailable()) {
          try {
            crawl = await crawlSiteWithFirecrawl(websiteUrl);
            crawler = "firecrawl";
          } catch (err) {
            // Firecrawl unavailable / out of credits: fall back to our own crawler.
            crawl = await crawlSite(websiteUrl);
            crawl.skipped.push(`Firecrawl unavailable (${String(err instanceof Error ? err.message : err).slice(0, 120)})`);
          }
        } else {
          crawl = await crawlSite(websiteUrl);
        }
      } else {
        crawl = await crawlSinglePage(websiteUrl);
      }
      if (!crawl.pages.length) throw new Error("We could not read that website. Check the address and try again.");


      const { profile, brief, provenance, assets } = await buildProfile(crawl.pages, websiteUrl);

      await supabase.from("business_pages").insert(
        crawl.pages.map((p) => ({
          owner_id: userId,
          profile_id: profileId,
          url: p.url,
          page_type: p.page_type,
          title: p.title,
          extracted_json: {
            meta_description: p.meta_description,
            headings: p.headings.slice(0, 20),
            phones: p.phones,
            emails: p.emails,
            socials: p.socials,
            images: p.images.slice(0, 10),
          } as any,
        })) as any,
      );

      const { data: saved, error: uErr } = await supabase
        .from("business_profiles")
        .update({
          status: "ready",
          pages_scanned: crawl.pages.length,
          profile_json: profile as any,
          brief_json: brief as any,
          provenance_json: provenance as any,
          assets_json: assets as any,
          error: crawl.skipped.length ? `Skipped: ${crawl.skipped.slice(0, 5).join(", ")}`.slice(0, 400) : null,
        })
        .eq("id", profileId)
        .select(PROFILE_COLUMNS)
        .single();
      if (uErr) throw new Error(uErr.message);

      if (job) {
        await supabase
          .from("jobs")
          .update({
            status: "succeeded",
            progress: 100,
            finished_at: new Date().toISOString(),
            output_json: { pages: crawl.pages.length, profile_id: profileId, crawler },
          })
          .eq("id", job.id);
      }

      return {
        profile: saved,
        crawler,
        pages: crawl.pages.map((p) => ({ url: p.url, page_type: p.page_type, title: p.title })),
        skipped: crawl.skipped,
      };
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err).slice(0, 400);
      if (data.depth === "deep") {
        await supabase.rpc("refund_credits", {
          _user_id: userId,
          _amount: DEEP_SCAN_CREDIT_COST,
          _reason: "deep_scan_failed",
          _job_id: job?.id,
        });
      }
      await supabase.from("business_profiles").update({ status: "failed", error: message }).eq("id", profileId);
      if (job) await supabase.from("jobs").update({ status: "failed", error: message, finished_at: new Date().toISOString() }).eq("id", job.id);
      throw new Error(message);
    }
  });

export const listBusinessProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("business_profiles")
      .select(PROFILE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile, error } = await context.supabase
      .from("business_profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", data.id)
      .single();
    if (error || !profile) throw new Error("Business profile not found");
    const { data: pages } = await context.supabase
      .from("business_pages")
      .select("id, url, page_type, title")
      .eq("profile_id", data.id)
      .order("created_at", { ascending: true });
    return { profile, pages: pages ?? [] };
  });

/** Owner corrections. Editing a field marks it as owner-confirmed in provenance. */
export const updateBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        profile: z.record(z.string(), z.unknown()),
        brief: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_profiles")
      .update({
        profile_json: data.profile as any,
        ...(data.brief ? { brief_json: data.brief as any } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Only a confirmed profile is treated as fact by ad generation. */
export const confirmBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_profiles")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("business_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Copies a discovered logo / hero image into the owner's private storage. */
export const importDiscoveredAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ profileId: z.string().uuid(), url: z.string().min(8).max(2048) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isSafePublicUrl } = await import("./research/crawl.server");
    const safe = isSafePublicUrl(data.url);
    if (!safe.ok || !safe.url) throw new Error(safe.reason ?? "That image cannot be imported.");

    const res = await fetch(safe.url.toString(), {
      headers: { "User-Agent": "EasyAdsBot/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Could not download that image (${res.status}).`);
    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/")) throw new Error("That link is not an image.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Images must be smaller than 8 MB.");

    const ext = (type.split("/")[1] ?? "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
    const path = `${userId}/brand/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("project-assets").upload(path, bytes, {
      contentType: type,
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: sErr } = await supabase.storage
      .from("project-assets")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr) throw new Error(sErr.message);

    const { data: row } = await supabase
      .from("business_profiles")
      .select("assets_json")
      .eq("id", data.profileId)
      .maybeSingle();
    const assets = ((row?.assets_json as any[]) ?? []).map((a) =>
      a?.url === data.url ? { ...a, imported_url: signed.signedUrl } : a,
    );
    await supabase.from("business_profiles").update({ assets_json: assets as any }).eq("id", data.profileId);

    await supabase.from("assets").insert({
      owner_id: userId,
      kind: "image",
      storage_path: path,
      external_url: data.url,
      meta: { source: "business_scan", profile_id: data.profileId } as any,
    } as any);

    return { url: signed.signedUrl, path };
  });

/** Turns a confirmed profile into a reusable brand kit. */
export const createBrandFromProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("business_profiles")
      .select("id, website_url, profile_json, brief_json, assets_json, brand_id")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Business profile not found");
    const p = (row.profile_json ?? {}) as any;
    const assets = (row.assets_json ?? []) as any[];
    const logo = assets.find((a) => a?.kind === "logo" && a?.imported_url)?.imported_url ?? null;

    const { data: brand, error: bErr } = await supabase
      .from("brands")
      .insert({
        owner_id: userId,
        name: (p.business_name || new URL(row.website_url).hostname).slice(0, 120),
        website_url: row.website_url,
        business_type: p.business_type ?? null,
        tagline: p.one_liner ?? null,
        tone: (row.brief_json as any)?.tone ?? p.brand_voice ?? null,
        primary_color: p.primary_color ?? null,
        secondary_color: p.secondary_color ?? null,
        phone: p.phone ?? null,
        address: p.locations?.[0]?.address ?? null,
        default_cta: p.cta ?? null,
        logo_url: logo,
        extracted_json: p,
      } as any)
      .select("id, name")
      .single();
    if (bErr) throw new Error(bErr.message);

    await supabase.from("business_profiles").update({ brand_id: brand.id }).eq("id", data.id);
    return { brandId: brand.id as string, name: brand.name as string };
  });
