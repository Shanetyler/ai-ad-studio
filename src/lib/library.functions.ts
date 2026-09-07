import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAppearancePrompt } from "@/lib/character";
import { CHARACTER_COLUMNS, signReference } from "@/lib/character.server";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ReferenceImageSchema = z.object({
  path: z.string().min(1).max(500),
  label: z.string().max(120).optional(),
  primary: z.boolean().optional(),
});

const AppearanceSchema = z.object({
  age_range: z.string().max(60).default(""),
  gender_presentation: z.string().max(60).default(""),
  ethnicity: z.string().max(80).default(""),
  hair: z.string().max(120).default(""),
  facial_hair: z.string().max(120).default(""),
  wardrobe: z.string().max(200).default(""),
  distinguishing: z.string().max(300).default(""),
  setting: z.string().max(200).default(""),
  framing: z.string().max(120).default(""),
});

const VoiceSchema = z.object({
  style: z.string().max(120).default(""),
  pace: z.string().max(60).default(""),
  accent: z.string().max(80).default(""),
  direction: z.string().max(600).default(""),
});

const GenerationSchema = z.object({
  seed: z.number().int().min(0).max(2147483647).optional(),
  aspect: z.string().max(12).optional(),
  model: z.string().max(80).optional(),
});

const CastSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["character", "voice"]),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).default(""),
  attributes: z.record(z.string(), z.string()).default({}),
  reference_url: z.string().max(1000).optional(),
  rights_confirmed: z.boolean(),
  reference_images: z.array(ReferenceImageSchema).max(8).default([]),
  primary_reference_path: z.string().max(500).nullable().optional(),
  appearance_json: AppearanceSchema.optional(),
  appearance_prompt: z.string().max(1500).nullable().optional(),
  voice_json: VoiceSchema.optional(),
  voice_provider: z.string().max(60).nullable().optional(),
  voice_provider_ref: z.string().max(200).nullable().optional(),
  generation_json: GenerationSchema.optional(),
  generation_seed: z.number().int().min(0).max(2147483647).nullable().optional(),
  consent_by: z.string().max(160).nullable().optional(),
  consent_scope: z.string().max(300).nullable().optional(),
});

export const listCast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cast_members")
      .select(CHARACTER_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

/** Signs the private reference images for one character so the UI can preview them. */
export const getCastReferenceUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ paths: z.array(z.string().max(500)).max(16) }).parse(input))
  .handler(async ({ data, context }) => {
    const out: Record<string, string> = {};
    for (const path of data.paths) {
      const url = await signReference(context.supabase, path, 60 * 60);
      if (url) out[path] = url;
    }
    return out;
  });

/** Truthful capability report for the Character Studio (no fake cloning claims). */
export const getCastCapabilities = createServerFn({ method: "GET" }).handler(async () => {
  const { providerStatus } = await import("@/lib/providers/index.server");
  const status = providerStatus();
  const video = status.providers.find((p) => p.kind === "video");
  const voice = status.providers.find((p) => p.kind === "voice");
  const image = status.providers.find((p) => p.kind === "image");
  return {
    spokespersonVideo: { configured: !!video?.configured, id: video?.id ?? null },
    voice: { configured: !!voice?.configured, id: voice?.id ?? null },
    stills: { configured: !!image?.configured, id: image?.id ?? null },
    /** No configured provider performs face or voice cloning. */
    cloning: false,
  };
});

export const saveCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CastSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.rights_confirmed) {
      throw new Error("You must confirm you have the rights and consent to use this likeness or voice.");
    }
    const { supabase, userId } = context;
    const { id, consent_scope, consent_by, ...rest } = data;

    const refs = rest.reference_images ?? [];
    // Deterministic primary: explicit choice, else the flagged one, else the first.
    const primary =
      (rest.primary_reference_path && refs.some((r) => r.path === rest.primary_reference_path)
        ? rest.primary_reference_path
        : refs.find((r) => r.primary)?.path) ?? refs[0]?.path ?? null;
    const normalizedRefs = refs.map((r) => ({ ...r, primary: r.path === primary }));

    const appearance = rest.appearance_json ?? undefined;
    const appearancePrompt =
      (rest.appearance_prompt && rest.appearance_prompt.trim()) ||
      (appearance ? buildAppearancePrompt(rest.name, rest.description ?? "", appearance) : null);

    const fields: Record<string, any> = {
      kind: rest.kind,
      name: rest.name,
      description: rest.description ?? "",
      attributes: rest.attributes ?? {},
      reference_url: rest.reference_url ?? null,
      rights_confirmed: rest.rights_confirmed,
      reference_images: normalizedRefs,
      primary_reference_path: primary,
      appearance_json: appearance ?? {},
      appearance_prompt: appearancePrompt,
      voice_json: rest.voice_json ?? {},
      voice_provider: rest.voice_provider ?? null,
      voice_provider_ref: rest.voice_provider_ref ?? null,
      generation_json: rest.generation_json ?? {},
      generation_seed: rest.generation_seed ?? rest.generation_json?.seed ?? null,
      consent_by: consent_by ?? null,
      consent_scope: consent_scope ?? null,
      consent_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await supabase.from("cast_members").update(fields as any).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: created, error } = await supabase
      .from("cast_members")
      .insert({ ...(fields as any), owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("cast_members")
      .select("reference_images")
      .eq("id", data.id)
      .maybeSingle();
    const paths = ((row?.reference_images ?? []) as { path: string }[]).map((r) => r.path).filter(Boolean);
    if (paths.length) {
      await context.supabase.storage.from("project-assets").remove(paths);
    }
    const { error } = await context.supabase.from("cast_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Removes a single reference image from storage (called before saving the record). */
export const deleteCastReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Not allowed");
    const { error } = await context.supabase.storage.from("project-assets").remove([data.path]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Production view of a saved character, used by the generation pipeline. */
export const getCharacterProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { loadCharacterProduction } = await import("@/lib/character.server");
    return loadCharacterProduction(context.supabase, data.id);
  });
