// Client-safe style presets for the Studio "Style Gallery" mode.
export type StylePreset = {
  id: string;
  name: string;
  tagline: string;
  prompt: string;
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "cinematic-noir",
    name: "Cinematic Noir",
    tagline: "Moody, high-contrast, anamorphic",
    prompt:
      "Cinematic noir aesthetic: hard key light, deep shadows, teal & amber grade, anamorphic lens flares, 2.39:1 framing, slow dolly moves.",
  },
  {
    id: "sunlit-lifestyle",
    name: "Sunlit Lifestyle",
    tagline: "Warm, natural, aspirational",
    prompt:
      "Sunlit lifestyle: golden-hour light, soft handheld camera, natural skin tones, film grain, real locations, candid moments.",
  },
  {
    id: "hyper-product",
    name: "Hyper Product",
    tagline: "Macro, glossy, tabletop",
    prompt:
      "Hyper product shots: macro lenses, glossy reflections, controlled studio light, rotating turntable moves, tactile close-ups of textures.",
  },
  {
    id: "ugc-authentic",
    name: "UGC Authentic",
    tagline: "Phone-shot, punchy captions",
    prompt:
      "UGC authentic: vertical phone footage, first-person selfie framing, natural indoor light, jump cuts, bold sans-serif on-screen captions.",
  },
  {
    id: "retro-vhs",
    name: "Retro VHS",
    tagline: "Analog warmth, chroma bleed",
    prompt:
      "Retro VHS: 4:3 letterbox on 9:16 canvas, scanlines, chroma bleed, magnetic tape artifacts, saturated primaries, 80s title cards.",
  },
  {
    id: "editorial-fashion",
    name: "Editorial Fashion",
    tagline: "High-key, graphic, cool",
    prompt:
      "Editorial fashion: high-key studio light on seamless paper, graphic negative space, cool neutral palette, minimal typography, deliberate model beats.",
  },
];

export function findStyle(id?: string) {
  return STYLE_PRESETS.find((s) => s.id === id);
}
