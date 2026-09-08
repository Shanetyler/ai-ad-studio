import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAppearancePrompt } from "@/lib/character";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CHARACTER_COLUMNS =
  "id, kind, name, description, attributes, reference_url, reference_images, primary_reference_path, appearance_json, appearance_prompt, voice_json, voice_provider, voice_provider_ref, generation_json, generation_seed, rights_confirmed, consent_by, consent_at, consent_scope, provider_ref, created_at";

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

/**
 * Collects every reference path the caller legitimately owns: paths recorded on
 * their own cast_members rows, plus editor paths under one of their own
 * character folders (`<uid>/characters/<characterId>/...`) which are uploaded
 * before the row's reference list is persisted.
 */
async function ownedReferencePaths(supabase: any, userId: string) {
  const { data, error } = await supabase.from("cast_members").select("id, reference_images, primary_reference_path");
  if (error) throw new Error(error.message);
  const recorded = new Set<string>();
  const folders = new Set<string>();
  for (const row of (data ?? []) as any[]) {
    folders.add(`${userId}/characters/${row.id}/`);
    if (row.primary_reference_path) recorded.add(row.primary_reference_path);
    for (const r of (row.reference_images ?? []) as { path?: string }[]) if (r?.path) recorded.add(r.path);
  }
  return {
    allows: (path: string) => recorded.has(path) || Array.from(folders).some((f) => path.startsWith(f)),
  };
}

/** Signs the private reference images for one character so the UI can preview them. */
export const getCastReferenceUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ paths: z.array(z.string().max(500)).max(16) }).parse(input))
  .handler(async ({ data, context }) => {
    const { signReference } = await import("@/lib/character.server");
    const guard = await ownedReferencePaths(context.supabase, context.userId);
    const out: Record<string, string> = {};
    for (const path of data.paths) {
      if (!guard.allows(path)) continue;
      const url = await signReference(context.supabase, path, 60 * 60);
      if (url) out[path] = url;
    }
    return out;
  });

/**
 * Truthful capability report for the Character Studio (no fake cloning claims).
 * Only booleans are exposed — provider identifiers stay server-side.
 */
export const getCastCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { providerStatus } = await import("@/lib/providers/index.server");
    const status = providerStatus();
    const configured = (kind: string) => !!status.providers.find((p) => p.kind === kind)?.configured;
    return {
      spokespersonVideo: { configured: configured("video") },
      voice: { configured: configured("voice") },
      stills: { configured: configured("image") },
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
    };

    if (id) {
      // Read the existing consent state so an edit never rewrites the original
      // confirmation timestamp. Owner-scoped as defence in depth on top of RLS.
      const { data: existing, error: readErr } = await supabase
        .from("cast_members")
        .select("id, rights_confirmed, consent_at, consent_user_id")
        .eq("id", id)
        .eq("owner_id", userId)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message);
      if (!existing) throw new Error("Character not found.");

      const wasConfirmed = Boolean((existing as any).rights_confirmed) && !!(existing as any).consent_at;
      fields.consent_at = wasConfirmed ? (existing as any).consent_at : new Date().toISOString();
      fields.consent_user_id = wasConfirmed ? ((existing as any).consent_user_id ?? userId) : userId;

      // owner_id is never part of `fields`, so an update cannot reassign ownership.
      const { error } = await supabase
        .from("cast_members")
        .update(fields as any)
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { id };
    }

    fields.consent_at = new Date().toISOString();
    fields.consent_user_id = userId;
    const { data: created, error } = await supabase
      .from("cast_members")
      .insert({ ...(fields as any), owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

/** Clears the confirmation record when the owner revokes rights for a character. */
export const revokeCastConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cast_members")
      .update({ rights_confirmed: false, consent_at: null, consent_user_id: null } as any)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Persists the reference list after staged files have been uploaded under the
 * real character id, and removes storage files the owner dropped while editing.
 */
export const updateCastReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reference_images: z.array(ReferenceImageSchema).max(8).default([]),
        primary_reference_path: z.string().max(500).nullable().optional(),
        delete_paths: z.array(z.string().min(1).max(500)).max(16).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prefix = `${userId}/characters/${data.id}/`;
    for (const r of data.reference_images) {
      if (!r.path.startsWith(`${userId}/`)) throw new Error("Not allowed");
    }
    const primary =
      (data.primary_reference_path && data.reference_images.some((r) => r.path === data.primary_reference_path)
        ? data.primary_reference_path
        : data.reference_images.find((r) => r.primary)?.path) ?? data.reference_images[0]?.path ?? null;
    const refs = data.reference_images.map((r) => ({ ...r, primary: r.path === primary }));

    const { data: updated, error } = await supabase
      .from("cast_members")
      .update({ reference_images: refs as any, primary_reference_path: primary })
      .eq("id", data.id)
      .eq("owner_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Character not found.");

    // Only after the record no longer points at them do we drop the old files.
    const removable = data.delete_paths.filter((p) => p.startsWith(prefix) || p.startsWith(`${userId}/characters/`));
    if (removable.length) {
      const { error: rmErr } = await supabase.storage.from("project-assets").remove(removable);
      if (rmErr) return { id: data.id, storage_cleanup_failed: true };
    }
    return { id: data.id, storage_cleanup_failed: false };
  });

export const deleteCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error: readErr } = await context.supabase
      .from("cast_members")
      .select("id, reference_images")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Character not found.");

    // Never orphan a project's selected character.
    const { count, error: countErr } = await context.supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("character_id", data.id);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        `This character is used by ${count} project${count === 1 ? "" : "s"}. Remove it from those projects before deleting it.`,
      );
    }

    const paths = ((row.reference_images ?? []) as { path: string }[]).map((r) => r.path).filter(Boolean);
    const { error } = await context.supabase
      .from("cast_members")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);

    let storage_cleanup_failed = false;
    if (paths.length) {
      const { error: rmErr } = await context.supabase.storage.from("project-assets").remove(paths);
      storage_cleanup_failed = !!rmErr;
    }
    return { ok: true, storage_cleanup_failed };
  });

/** Removes a single reference image belonging to one of the caller's characters. */
export const deleteCastReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ characterId: z.string().uuid(), path: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: readErr } = await supabase
      .from("cast_members")
      .select("id, reference_images, primary_reference_path")
      .eq("id", data.characterId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Character not found.");

    const refs = ((row.reference_images ?? []) as { path: string }[]) ?? [];
    const belongsToCharacter =
      refs.some((r) => r.path === data.path) ||
      row.primary_reference_path === data.path ||
      data.path.startsWith(`${userId}/characters/${data.characterId}/`);
    if (!belongsToCharacter) throw new Error("Not allowed");

    const remaining = refs.filter((r) => r.path !== data.path);
    const primary =
      row.primary_reference_path === data.path ? (remaining[0]?.path ?? null) : row.primary_reference_path;
    const { error: updErr } = await supabase
      .from("cast_members")
      .update({ reference_images: remaining as any, primary_reference_path: primary })
      .eq("id", data.characterId)
      .eq("owner_id", userId);
    if (updErr) throw new Error(updErr.message);

    const { error } = await supabase.storage.from("project-assets").remove([data.path]);
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
