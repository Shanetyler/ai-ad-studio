import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ResearchInput = z.object({ url: z.string().url().max(2048) });

export type BrandResearch = {
  name: string;
  tagline: string;
  tone: string;
  primary_color: string;
  secondary_color: string;
  target_audience: string;
  key_products: string[];
  value_props: string[];
  ad_hooks: string[];
};

export const researchBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { aiJson } = await import("./ai-gateway.server");

    // Fetch page HTML (cheap; ignore failures)
    let siteText = "";
    try {
      const res = await fetch(data.url, {
        headers: { "User-Agent": "EasyAdsBot/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();
      siteText = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 8000);
    } catch {
      // continue with empty siteText
    }

    const research = await aiJson<BrandResearch>({
      system:
        "You are a senior brand strategist. Extract a concise brand profile from a website. Return strict JSON with keys: name, tagline, tone, primary_color (hex), secondary_color (hex), target_audience, key_products (string array up to 6), value_props (string array up to 5), ad_hooks (string array of 5 short video ad hook ideas).",
      prompt: `URL: ${data.url}\n\nPage content excerpt:\n${siteText || "(no content fetched)"}`,
    });

    // Persist brand
    const { data: brand, error } = await context.supabase
      .from("brands")
      .insert({
        owner_id: context.userId,
        name: research.name || new URL(data.url).hostname,
        website_url: data.url,
        primary_color: research.primary_color ?? null,
        secondary_color: research.secondary_color ?? null,
        tone: research.tone ?? null,
        tagline: research.tagline ?? null,
        extracted_json: research as unknown as Record<string, unknown>,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { brand, research };
  });

export const listBrands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brands")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
