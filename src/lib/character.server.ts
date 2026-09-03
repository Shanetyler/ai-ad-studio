// Server-only helpers that turn a saved cast_members row into everything the
// production pipeline needs (signed reference frame, appearance prompt, voice).

import type { CharacterProduction, CharacterReferenceImage } from "@/lib/character";
import { buildAppearancePrompt, voiceDirectionOf } from "@/lib/character";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CHARACTER_COLUMNS =
  "id, kind, name, description, attributes, reference_url, reference_images, primary_reference_path, appearance_json, appearance_prompt, voice_json, voice_provider, voice_provider_ref, generation_json, generation_seed, rights_confirmed, consent_by, consent_at, consent_scope, provider_ref, created_at";

export { CHARACTER_COLUMNS };

/** Signs a private project-assets path so a provider can read the frame. */
export async function signReference(supabase: any, path: string, seconds = 60 * 60 * 6) {
  const { data, error } = await supabase.storage.from("project-assets").createSignedUrl(path, seconds);
  if (error) return null;
  return (data?.signedUrl as string) ?? null;
}

export async function loadCharacterProduction(
  supabase: any,
  characterId: string,
): Promise<CharacterProduction | null> {
  const { data: row } = await supabase
    .from("cast_members")
    .select(CHARACTER_COLUMNS)
    .eq("id", characterId)
    .maybeSingle();
  if (!row) return null;

  const appearance = (row.appearance_json ?? {}) as Record<string, string>;
  const voice = (row.voice_json ?? {}) as Record<string, string>;
  const refs = (row.reference_images ?? []) as CharacterReferenceImage[];
  const primaryPath: string | null =
    row.primary_reference_path ?? refs.find((r) => r.primary)?.path ?? refs[0]?.path ?? null;

  let primaryUrl: string | undefined;
  if (primaryPath) {
    const signed = await signReference(supabase, primaryPath);
    if (signed) primaryUrl = signed;
  } else if (row.reference_url) {
    // Legacy records may only carry a remote reference URL.
    primaryUrl = row.reference_url as string;
  }

  return {
    id: row.id,
    name: row.name,
    appearance_prompt:
      (row.appearance_prompt as string | null) || buildAppearancePrompt(row.name, row.description ?? "", appearance),
    voice_direction: voiceDirectionOf(voice) || (row.description ?? ""),
    voice_provider: row.voice_provider ?? null,
    voice_provider_ref: row.voice_provider_ref ?? null,
    seed: (row.generation_seed as number | null) ?? undefined,
    ...(primaryUrl ? { primary_reference_url: primaryUrl } : {}),
    rights_confirmed: Boolean(row.rights_confirmed),
  };
}
