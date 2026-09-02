// Client-safe types for the reusable Character Studio.

export type CharacterKind = "character" | "voice";

export type CharacterReferenceImage = {
  /** Storage path inside the private project-assets bucket. */
  path: string;
  label?: string;
  primary?: boolean;
};

export type CharacterAppearance = {
  age_range: string;
  gender_presentation: string;
  ethnicity: string;
  hair: string;
  facial_hair: string;
  wardrobe: string;
  distinguishing: string;
  setting: string;
  framing: string;
};

export const EMPTY_APPEARANCE: CharacterAppearance = {
  age_range: "",
  gender_presentation: "",
  ethnicity: "",
  hair: "",
  facial_hair: "",
  wardrobe: "",
  distinguishing: "",
  setting: "",
  framing: "",
};

export type CharacterVoice = {
  style: string;
  pace: string;
  accent: string;
  /** Free-text delivery notes fed to the script + narration. */
  direction: string;
};

export const EMPTY_VOICE: CharacterVoice = { style: "", pace: "", accent: "", direction: "" };

export type CharacterGeneration = {
  /** Locked seed keeps a character visually consistent across ads. */
  seed?: number;
  aspect?: string;
  model?: string;
};

export type CharacterRecord = {
  id: string;
  kind: CharacterKind;
  name: string;
  description: string;
  attributes: Record<string, string>;
  reference_url: string | null;
  reference_images: CharacterReferenceImage[];
  primary_reference_path: string | null;
  appearance_json: CharacterAppearance;
  appearance_prompt: string | null;
  voice_json: CharacterVoice;
  voice_provider: string | null;
  voice_provider_ref: string | null;
  generation_json: CharacterGeneration;
  generation_seed: number | null;
  rights_confirmed: boolean;
  consent_by: string | null;
  consent_at: string | null;
  consent_scope: string | null;
  provider_ref: string | null;
  created_at: string;
};

/** Everything the production pipeline needs about a character. */
export type CharacterProduction = {
  id: string;
  name: string;
  appearance_prompt: string;
  voice_direction: string;
  voice_provider?: string | null;
  voice_provider_ref?: string | null;
  seed?: number;
  /** Signed URL for the primary reference frame, when one exists. */
  primary_reference_url?: string;
  rights_confirmed: boolean;
};

/**
 * Builds the reusable appearance prompt block. This exact text is injected into
 * every generation for the character so it stays consistent across ads.
 */
export function buildAppearancePrompt(
  name: string,
  description: string,
  a: Partial<CharacterAppearance>,
): string {
  const bits = [
    a.age_range && `around ${a.age_range}`,
    a.gender_presentation,
    a.ethnicity,
    a.hair && `${a.hair} hair`,
    a.facial_hair,
    a.wardrobe && `wearing ${a.wardrobe}`,
    a.distinguishing,
  ]
    .filter(Boolean)
    .join(", ");
  const scene = [a.setting && `Setting: ${a.setting}.`, a.framing && `Framing: ${a.framing}.`].filter(Boolean).join(" ");
  return [
    `${name || "The spokesperson"}: ${bits || description || "on-camera spokesperson"}.`,
    description && bits ? description : "",
    scene,
    "Keep the same person, face, hair and wardrobe in every shot.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}

export function voiceDirectionOf(v: Partial<CharacterVoice>): string {
  return [v.style, v.accent, v.pace && `${v.pace} pace`, v.direction].filter(Boolean).join(", ");
}
