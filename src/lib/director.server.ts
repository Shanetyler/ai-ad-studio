// Server-only creative director: decides HOW each beat of the ad is shot.
// The cheapest sufficient shot type always wins so unit economics stay viable.

import type { AdPlan, AdScene, AdStyle, ShotType } from "@/lib/ad-types";
import type { BusinessProfileData, CreativeBrief } from "@/lib/business-profile";
import type { CharacterProduction } from "@/lib/character";

export type DirectorInput = {
  plan: AdPlan;
  style: AdStyle;
  profile?: BusinessProfileData;
  brief?: CreativeBrief;
  character?: CharacterProduction | null;
  /** Owner-supplied media (uploads / imported brand assets) available for beats. */
  businessMedia?: string[];
  /** True when a real AI video provider is configured. */
  videoProviderReal: boolean;
  /** True when a real AI image provider is configured. */
  imageProviderReal: boolean;
  /** Hard cap on expensive AI video shots per ad. */
  maxAiVideoShots?: number;
};

export type Shot = {
  scene_id: string;
  shot_type: ShotType;
  /** Prompt for AI shots; empty for graphics/media shots. */
  prompt: string;
  /** Reference frame for character-consistent AI shots. */
  reference_url?: string;
  /** Business media / imported asset used for the beat. */
  image_url?: string;
  reason: string;
  /** Whether the character speaks in this beat. */
  spokesperson: boolean;
};

export type ShotList = {
  shots: Shot[];
  ai_video_shots: number;
  ai_image_shots: number;
  notes: string[];
};

const TALKING = /hook|problem|meet|why|promise|testimonial|trust|closing|book|call|offer/i;

/** Beats where a person on camera genuinely adds value. */
function isTalkingBeat(scene: AdScene, index: number, total: number) {
  if (index === 0) return true;
  if (index === total - 1) return true;
  return TALKING.test(`${scene.title} ${scene.caption}`);
}

export function directShots(input: DirectorInput): ShotList {
  const { plan, style, character } = input;
  const media = [...(input.businessMedia ?? [])];
  const notes: string[] = [];
  const maxVideo = input.maxAiVideoShots ?? 2;

  const canSpokesperson = Boolean(
    character && character.appearance_prompt && character.primary_reference_url && input.videoProviderReal,
  );
  if (character && !input.videoProviderReal) {
    notes.push(
      `${character.name} is attached to this ad for script and voice direction. AI spokesperson footage needs a video provider to be configured, so those beats are assembled from your media and motion graphics.`,
    );
  }
  if (character && input.videoProviderReal && !character.primary_reference_url) {
    notes.push(
      `${character.name} has no primary reference image, so consistent spokesperson footage cannot be generated. Add a reference image in the Character Studio.`,
    );
  }

  let aiVideo = 0;
  let aiImage = 0;

  const shots: Shot[] = plan.scenes.map((scene, i) => {
    const talking = isTalkingBeat(scene, i, plan.scenes.length);
    const ownMedia = scene.image_url ?? media.shift();

    // 1. Owner media is free and the most authentic.
    if (ownMedia && !(talking && canSpokesperson && aiVideo < maxVideo)) {
      return {
        scene_id: scene.id,
        shot_type: "business_media",
        prompt: "",
        image_url: ownMedia,
        reason: "Uses your own business media — no generation cost.",
        spokesperson: false,
      };
    }

    // 2. Spokesperson video only for talking beats, capped.
    if (talking && canSpokesperson && aiVideo < maxVideo) {
      aiVideo += 1;
      return {
        scene_id: scene.id,
        shot_type: "ai_video",
        prompt: spokespersonPrompt(scene, character!, style, plan),
        reference_url: character!.primary_reference_url!,
        reason: `${character!.name} on camera for this beat.`,
        spokesperson: true,
      };
    }

    // 3. A generated still is far cheaper than video for illustrative beats.
    if (input.imageProviderReal && scene.description && !talking && aiImage < 2) {
      aiImage += 1;
      return {
        scene_id: scene.id,
        shot_type: "ai_image",
        prompt: `${scene.description}. ${style.tone} advertising still, ${style.aspect} framing, no text overlays.`,
        reason: "Generated still image — cheaper than AI video for this beat.",
        spokesperson: false,
      };
    }

    // 4. Motion graphics from the browser renderer: free.
    return {
      scene_id: scene.id,
      shot_type: "graphics",
      prompt: "",
      reason: "Typography and motion graphics render locally at no cost.",
      spokesperson: false,
    };
  });

  if (aiVideo === 0 && canSpokesperson) {
    notes.push("No beat needed AI video, so this ad renders entirely from your media and motion graphics.");
  }

  return { shots, ai_video_shots: aiVideo, ai_image_shots: aiImage, notes };
}

export function spokespersonPrompt(
  scene: AdScene,
  character: CharacterProduction,
  style: AdStyle,
  plan: AdPlan,
): string {
  const line = scene.caption || plan.hook;
  return [
    character.appearance_prompt,
    character.voice_direction ? `Voice and delivery: ${character.voice_direction}.` : "",
    `Scene: ${scene.description || scene.title}.`,
    `The subject speaks directly to camera and says: ${line}`,
    `${style.tone} commercial look, ${style.aspect} framing, natural lighting, no on-screen text.`,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2200);
}

/** Applies a shot list back onto the plan so the renderer can assemble it. */
export function applyShotsToPlan(plan: AdPlan, list: ShotList): AdPlan {
  const byId = new Map(list.shots.map((s) => [s.scene_id, s]));
  return {
    ...plan,
    scenes: plan.scenes.map((scene) => {
      const shot = byId.get(scene.id);
      if (!shot) return scene;
      return {
        ...scene,
        shot_type: shot.shot_type,
        ...(shot.image_url ? { image_url: shot.image_url } : {}),
      };
    }),
  };
}
