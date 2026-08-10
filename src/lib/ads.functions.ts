import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_CREDIT_COST, RENDER_CREDIT_COST } from "@/lib/ad-types";
import type { AdPlan, AdStyle, BusinessInfo } from "@/lib/ad-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Trims and truncates instead of rejecting long free-text input. */
const clip = (max: number) =>
  z
    .string()
    .default("")
    .transform((s) => s.trim().slice(0, max));

const BusinessSchema = z.object({
  business_name: z.string().trim().min(1).max(120),
  business_type: clip(80),
  description: clip(2000),
  products: clip(2000),
  target_customer: clip(1000),
  location: clip(200),
  phone: clip(40),
  website: clip(300),
  cta: clip(300),
  offer: clip(400),
  notes: clip(1000),
});

const StyleSchema = z.object({
  ad_type: z.string().max(80),
  tone: z.string().max(40),
  aspect: z.enum(["9:16", "1:1", "16:9"]),
  duration: z.number().int().min(10).max(90),
});

const PlanSchema = z.object({
  hook: z.string().max(300),
  cta: z.string().max(200),
  voiceover: z.string().max(4000),
  music_style: z.string().max(120),
  captions_enabled: z.boolean(),
  palette: z.object({ primary: z.string().max(32), secondary: z.string().max(32) }),
  font: z.enum(["display", "sans", "mono"]),
  logo_url: z.string().max(600).optional(),
  contact_line: z.string().max(240).optional(),
  visuals_source: z.enum(["demo", "ai"]),
  character_id: z.string().max(60).optional(),
  voice_id: z.string().max(60).optional(),
  objective: z.string().max(120).optional(),
  audience: z.string().max(400).optional(),
  transition: z.enum(["cut", "fade", "slide", "zoom"]).optional(),
  scenes: z
    .array(
      z.object({
        id: z.string().max(24),
        duration_s: z.number().min(1).max(20),
        title: z.string().max(120),
        description: z.string().max(800),
        caption: z.string().max(140),
        asset_id: z.string().max(60).optional(),
        image_url: z.string().max(1000).optional(),
      }),
    )
    .min(1)
    .max(12),
});

async function consume(ctx: any, userId: string, amount: number, reason: string, jobId?: string) {
  const { error } = await ctx.supabase.rpc("consume_credits", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _job_id: jobId ?? null,
  });
  if (error) {
    if (error.message.includes("INSUFFICIENT_CREDITS")) {
      throw new Error("Not enough credits. Upgrade your plan to keep creating ads.");
    }
    throw new Error(error.message);
  }
}

async function refund(ctx: any, userId: string, amount: number, reason: string, jobId?: string) {
  await ctx.supabase.rpc("refund_credits", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _job_id: jobId ?? null,
  });
}

/** Step 1-4 of the wizard: writes the ad script + scene plan. Costs 2 credits. */
export const generateAdPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        business: BusinessSchema,
        style: StyleSchema,
        brandId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const business = data.business as BusinessInfo;
    const style = data.style as AdStyle;

    const { data: job, error: jErr } = await supabase
      .from("jobs")
      .insert({
        owner_id: userId,
        project_id: data.projectId ?? null,
        kind: "script",
        status: "running",
        cost_credits: PLAN_CREDIT_COST,
        started_at: new Date().toISOString(),
        input_json: { business, style },
      })
      .select("id")
      .single();
    if (jErr) throw new Error(jErr.message);

    await consume(context, userId, PLAN_CREDIT_COST, "ad_plan", job.id);

    let plan: AdPlan;
    try {
      const { getAIProvider } = await import("@/lib/providers/index.server");
      let brandTone: string | undefined;
      if (data.brandId) {
        const { data: brand } = await supabase
          .from("brands")
          .select("tone, primary_color, secondary_color, logo_url, default_cta, font_preference, phone, website_url")
          .eq("id", data.brandId)
          .maybeSingle();
        brandTone = brand?.tone ?? undefined;
        if (brand) {
          business.phone = business.phone || brand.phone || "";
          business.website = business.website || brand.website_url || "";
          business.cta = business.cta || brand.default_cta || "";
        }
      }
      plan = await getAIProvider().generateAdScript({ business, style, brandTone });

      if (data.brandId) {
        const { data: brand } = await supabase
          .from("brands")
          .select("primary_color, secondary_color, logo_url, font_preference")
          .eq("id", data.brandId)
          .maybeSingle();
        if (brand) {
          plan.palette = {
            primary: brand.primary_color || plan.palette.primary,
            secondary: brand.secondary_color || plan.palette.secondary,
          };
          if (brand.logo_url) plan.logo_url = brand.logo_url;
          if (brand.font_preference === "display" || brand.font_preference === "sans" || brand.font_preference === "mono") {
            plan.font = brand.font_preference;
          }
        }
      }
    } catch (err) {
      await refund(context, userId, PLAN_CREDIT_COST, "ad_plan_failed", job.id);
      await supabase
        .from("jobs")
        .update({ status: "failed", error: String(err).slice(0, 400), finished_at: new Date().toISOString() })
        .eq("id", job.id);
      throw err;
    }

    const title = `${business.business_name} — ${style.ad_type}`.slice(0, 120);
    let projectId = data.projectId;

    if (projectId) {
      const { error } = await supabase
        .from("projects")
        .update({
          title,
          brief: business.description,
          business_json: business as any,
          plan_json: plan as any,
          ad_type: style.ad_type,
          tone: style.tone,
          aspect_ratio: style.aspect,
          duration_target: style.duration,
          brand_id: data.brandId ?? null,
          status: "planned",
        })
        .eq("id", projectId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabase
        .from("projects")
        .insert({
          owner_id: userId,
          title,
          brief: business.description,
          business_json: business as any,
          plan_json: plan as any,
          ad_type: style.ad_type,
          tone: style.tone,
          aspect_ratio: style.aspect,
          duration_target: style.duration,
          brand_id: data.brandId ?? null,
          status: "planned",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      projectId = created.id;
    }

    await supabase
      .from("jobs")
      .update({
        status: "succeeded",
        project_id: projectId,
        progress: 100,
        finished_at: new Date().toISOString(),
        output_json: { scenes: plan.scenes.length },
      })
      .eq("id", job.id);

    return { projectId: projectId!, plan };
  });

/** Saves editor changes to the plan. Free. */
export const updateAdPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), plan: PlanSchema, title: z.string().max(120).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("projects")
      .update({ plan_json: data.plan as any, ...(data.title ? { title: data.title } : {}) })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select(
        "id, title, brief, status, business_json, plan_json, ad_type, tone, aspect_ratio, duration_target, video_status, supabase_video_path, video_mime, duration_seconds, brand_id, render_error, credits_used, created_at",
      )
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error("Ad not found");
    return project;
  });

export const listAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, title, status, ad_type, tone, aspect_ratio, video_status, supabase_video_path, duration_seconds, created_at, plan_json")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects")
      .select("supabase_video_path")
      .eq("id", data.projectId)
      .maybeSingle();
    if (project?.supabase_video_path) {
      await context.supabase.storage.from("ad-videos").remove([project.supabase_video_path]);
    }
    await context.supabase.from("storyboards").delete().eq("project_id", data.projectId);
    await context.supabase.from("scripts").delete().eq("project_id", data.projectId);
    const { error } = await context.supabase.from("projects").delete().eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase
      .from("projects")
      .select("title, brief, business_json, plan_json, ad_type, tone, aspect_ratio, duration_target, brand_id")
      .eq("id", data.projectId)
      .single();
    if (error || !src) throw new Error("Ad not found");
    const { data: copy, error: cErr } = await supabase
      .from("projects")
      .insert({ ...src, owner_id: userId, title: `${src.title} (copy)`.slice(0, 120), status: "planned" })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    return { projectId: copy.id };
  });

/** Reserves render credits before the browser renders the video. */
export const startAdRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, video_status")
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error("Ad not found");
    if (project.video_status === "rendering") throw new Error("A render is already running for this ad");

    const { providerStatus } = await import("@/lib/providers/index.server");
    const status = providerStatus();

    const { data: job, error: jErr } = await supabase
      .from("jobs")
      .insert({
        owner_id: userId,
        project_id: data.projectId,
        kind: "video",
        status: "running",
        cost_credits: RENDER_CREDIT_COST,
        started_at: new Date().toISOString(),
        model_id: status.demoMode ? "easyad-browser-renderer" : "fal-ai/kling-video",
      })
      .select("id")
      .single();
    if (jErr) throw new Error(jErr.message);

    await consume(context, userId, RENDER_CREDIT_COST, "ad_render", job.id);

    await supabase
      .from("projects")
      .update({
        video_status: "rendering",
        render_error: null,
        render_provider: status.demoMode ? "easyad-browser-renderer" : "fal-ai",
      })
      .eq("id", data.projectId);

    return { jobId: job.id, uploadPrefix: `${userId}/`, demoMode: status.demoMode };
  });

export const completeAdRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        jobId: z.string().uuid(),
        path: z.string().min(3).max(400),
        mime: z.string().max(60),
        duration: z.number().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("projects")
      .update({
        video_status: "ready",
        status: "complete",
        supabase_video_path: data.path,
        video_mime: data.mime,
        duration_seconds: data.duration,
        credits_used: PLAN_CREDIT_COST + RENDER_CREDIT_COST,
      })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    await supabase
      .from("jobs")
      .update({ status: "succeeded", progress: 100, finished_at: new Date().toISOString(), output_json: { path: data.path } })
      .eq("id", data.jobId);
    return { ok: true };
  });

export const failAdRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().uuid(), jobId: z.string().uuid(), message: z.string().max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await refund(context, userId, RENDER_CREDIT_COST, "ad_render_failed", data.jobId);
    await supabase
      .from("projects")
      .update({ video_status: "failed", render_error: data.message.slice(0, 400) })
      .eq("id", data.projectId);
    await supabase
      .from("jobs")
      .update({ status: "failed", error: data.message.slice(0, 400), finished_at: new Date().toISOString() })
      .eq("id", data.jobId);
    return { ok: true, refunded: RENDER_CREDIT_COST };
  });

export const getAdVideoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("supabase_video_path")
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error("Ad not found");
    if (!project.supabase_video_path) return { url: null };
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("ad-videos")
      .createSignedUrl(project.supabase_video_path, 60 * 60 * 4);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

/* -------------------------------- brand kit ------------------------------- */

const BrandKitSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  business_type: z.string().max(80).default(""),
  website_url: z.string().max(300).default(""),
  logo_url: z.string().max(1000).default(""),
  primary_color: z.string().max(32).default("#f59e0b"),
  secondary_color: z.string().max(32).default("#111827"),
  tone: z.string().max(60).default("Professional"),
  tagline: z.string().max(200).default(""),
  phone: z.string().max(40).default(""),
  address: z.string().max(200).default(""),
  font_preference: z.enum(["display", "sans", "mono"]).default("display"),
  default_cta: z.string().max(120).default(""),
  is_default: z.boolean().default(true),
});

export const saveBrandKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BrandKitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...fields } = data;
    if (fields.is_default) {
      await supabase.from("brands").update({ is_default: false }).eq("owner_id", userId);
    }
    if (id) {
      const { error } = await supabase.from("brands").update(fields).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: created, error } = await supabase
      .from("brands")
      .insert({ ...fields, owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const listBrandKits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brands")
      .select(
        "id, name, business_type, website_url, logo_url, primary_color, secondary_color, tone, tagline, phone, address, font_preference, default_cta, is_default",
      )
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* --------------------------------- usage ---------------------------------- */

export const getUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: credits } = await supabase.rpc("credit_balance", { _user_id: userId });
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("tier, monthly_credit_grant, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("video_status", "ready")
      .gte("created_at", monthStart.toISOString());
    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("delta, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    return {
      credits: (credits as number | null) ?? 0,
      tier: sub?.tier ?? "free",
      monthlyGrant: sub?.monthly_credit_grant ?? 50,
      adsThisMonth: count ?? 0,
      ledger: ledger ?? [],
    };
  });
