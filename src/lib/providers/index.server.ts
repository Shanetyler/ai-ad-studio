// Server-only provider registry. Real providers activate only when their
// credentials exist; otherwise Easy Ad runs in demo mode with mock providers.

import { aiImage, aiJson } from "@/lib/ai-gateway.server";
import type { AdPlan, AdStyle, BusinessInfo } from "@/lib/ad-types";
import { pickAssetsForScenes } from "@/lib/media-library";
import type {
  AIProvider,
  ImageProvider,
  MediaProvider,
  ProviderStatus,
  VideoProvider,
  VoiceProvider,
} from "./types";

const env = (name: string) => process.env[name]?.trim() || "";
const truthy = (v: string) => ["1", "true", "yes", "on"].includes(v.toLowerCase());

export const falEnabled = () => !!env("FAL_KEY") && truthy(env("FAL_ENABLED") || "false");
export const aiEnabled = () => !!env("LOVABLE_API_KEY");
export const voiceEnabled = () => !!env("ELEVENLABS_API_KEY");

/* ------------------------------ script / plan ------------------------------ */

function sceneCount(duration: number) {
  if (duration <= 15) return 4;
  if (duration <= 30) return 5;
  if (duration <= 45) return 6;
  return 7;
}

function mockPlan(business: BusinessInfo, style: AdStyle): AdPlan {
  const name = business.business_name || "Your business";
  const where = business.location ? ` in ${business.location}` : "";
  const offer = business.offer?.trim();
  const cta = business.cta?.trim() || "Call today for your free estimate.";
  const n = sceneCount(style.duration);
  const per = Math.max(2, Math.round((style.duration / n) * 10) / 10);
  const assets = pickAssetsForScenes(business.business_type, n);

  const beats: Array<{ title: string; description: string; caption: string }> = [
    {
      title: "The problem",
      description: `Everyday frustration your customer feels before finding ${name}.`,
      caption: business.target_customer ? `For ${business.target_customer}` : "Tired of settling for less?",
    },
    {
      title: "Meet the pro",
      description: `${name}${where} steps in — ${business.description || business.products || "doing the work properly"}.`,
      caption: `${name}${where}`,
    },
    {
      title: "The work",
      description: business.products || "The service in motion: careful, fast, professional.",
      caption: business.products ? business.products.split(/[,.]/)[0]!.trim() : "Done right the first time",
    },
    {
      title: "The result",
      description: "The finished result the customer is proud of.",
      caption: offer ? offer : "Results you can see",
    },
    {
      title: "Happy customer",
      description: "A satisfied customer, smiling, recommending the business.",
      caption: "Locals love it",
    },
    {
      title: "Why choose us",
      description: business.notes || "Trusted, insured, and fully guaranteed work.",
      caption: "Trusted & guaranteed",
    },
    {
      title: "Book now",
      description: "Closing card with logo, offer and contact details.",
      caption: cta,
    },
  ];

  const scenes = Array.from({ length: n }, (_, i) => {
    const beat = i === n - 1 ? beats[beats.length - 1]! : beats[i]!;
    return {
      id: `s${i + 1}`,
      duration_s: per,
      title: beat.title,
      description: beat.description,
      caption: beat.caption,
      asset_id: assets[i],
    };
  });

  const contact = [business.phone, business.website].filter(Boolean).join("  •  ");

  return {
    hook: offer ? `${offer} — only at ${name}.` : `${name}${where} does it right the first time.`,
    scenes,
    cta,
    voiceover: [
      offer ? `${offer}.` : `Looking for ${business.business_type || "help"}${where}?`,
      `${name} ${business.description ? business.description : "delivers professional results"}.`,
      business.products ? `We handle ${business.products}.` : "",
      cta,
    ]
      .filter(Boolean)
      .join(" "),
    music_style: style.tone === "Luxury" ? "Cinematic, elegant piano" : style.tone === "Energetic" ? "Upbeat electronic" : "Confident modern pop",
    captions_enabled: true,
    palette: { primary: "#f59e0b", secondary: "#111827" },
    font: "display",
    contact_line: contact || undefined,
    visuals_source: "demo",
  };
}

class MockAIProvider implements AIProvider {
  id = "easyad-template-engine";
  mode = "mock" as const;
  async generateAdScript(input: { business: BusinessInfo; style: AdStyle }) {
    return mockPlan(input.business, input.style);
  }
}

class GatewayAIProvider implements AIProvider {
  id = "lovable-ai-gateway";
  mode = "real" as const;
  async generateAdScript(input: { business: BusinessInfo; style: AdStyle; brandTone?: string }) {
    const { business, style } = input;
    const n = sceneCount(style.duration);
    const fallback = mockPlan(business, style);
    try {
      const out = await aiJson<{
        hook: string;
        cta: string;
        voiceover: string;
        music_style: string;
        scenes: Array<{ title: string; description: string; caption: string }>;
      }>({
        system:
          "You are a direct-response ad creative director. Write short-form video ads for small businesses. Return strict JSON.",
        prompt: `Create a ${style.duration}-second ${style.aspect} ${style.ad_type} ad in a ${style.tone} tone.
Business: ${JSON.stringify(business)}
Return JSON: { "hook": string, "cta": string, "voiceover": string, "music_style": string, "scenes": [{"title","description","caption"}] } with exactly ${n} scenes. Captions must be under 48 characters.`,
      });
      const per = Math.max(2, Math.round((style.duration / n) * 10) / 10);
      const assets = pickAssetsForScenes(business.business_type, n);
      const scenes = (out.scenes ?? []).slice(0, n).map((s, i) => ({
        id: `s${i + 1}`,
        duration_s: per,
        title: s.title || `Scene ${i + 1}`,
        description: s.description || "",
        caption: (s.caption || "").slice(0, 60),
        asset_id: assets[i],
      }));
      if (!scenes.length) return fallback;
      return {
        ...fallback,
        hook: out.hook || fallback.hook,
        cta: out.cta || fallback.cta,
        voiceover: out.voiceover || fallback.voiceover,
        music_style: out.music_style || fallback.music_style,
        scenes,
      };
    } catch {
      return fallback;
    }
  }
}

/* --------------------------------- video ---------------------------------- */

class MockVideoProvider implements VideoProvider {
  id = "easyad-demo-renderer";
  mode = "mock" as const;
  async generateScene() {
    // Demo mode: no external service is called. Scenes are composed from our own
    // generated demo media by the Easy Ad renderer.
    return { id: "demo", status: "succeeded" as const, url: undefined };
  }
  async getGenerationStatus(id: string) {
    return { id, status: "succeeded" as const };
  }
  async downloadVideo() {
    return { url: null };
  }
}

class FalVideoProvider implements VideoProvider {
  id = "fal-ai/kling-video";
  mode = "real" as const;
  async generateScene(input: { prompt: string; aspect: string; duration: number; imageUrl?: string }) {
    const key = env("FAL_KEY");
    const path = input.imageUrl
      ? "fal-ai/kling-video/v2/master/image-to-video"
      : "fal-ai/kling-video/v2/master/text-to-video";
    const res = await fetch(`https://queue.fal.run/${path}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: input.prompt.slice(0, 2400),
        duration: input.duration <= 5 ? "5" : "10",
        aspect_ratio: input.aspect,
        ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
      }),
    });
    if (!res.ok) return { id: "", status: "failed" as const, error: `Provider error ${res.status}` };
    const json = (await res.json()) as { request_id: string };
    return { id: json.request_id, status: "queued" as const };
  }
  async getGenerationStatus(id: string) {
    const res = await fetch(`https://queue.fal.run/requests/${id}/status`, {
      headers: { Authorization: `Key ${env("FAL_KEY")}` },
    });
    if (!res.ok) return { id, status: "failed" as const, error: `Provider error ${res.status}` };
    const json = (await res.json()) as { status: string };
    const status =
      json.status === "COMPLETED" ? "succeeded" : json.status === "IN_PROGRESS" ? "running" : "queued";
    return { id, status: status as "queued" | "running" | "succeeded" };
  }
  async downloadVideo(id: string) {
    const res = await fetch(`https://queue.fal.run/requests/${id}`, {
      headers: { Authorization: `Key ${env("FAL_KEY")}` },
    });
    if (!res.ok) return { url: null };
    const json = (await res.json()) as { video?: { url?: string } };
    return { url: json.video?.url ?? null };
  }
}

/* --------------------------------- voice ---------------------------------- */

class MockVoiceProvider implements VoiceProvider {
  id = "easyad-demo-voice";
  mode = "mock" as const;
  async generateVoice() {
    return {
      audioBase64: null,
      mime: null,
      note:
        "Demo mode: no voice service is configured, so the ad renders with captions and a music bed. Connect a voice provider to add narration.",
    };
  }
}

class ElevenLabsVoiceProvider implements VoiceProvider {
  id = "elevenlabs";
  mode = "real" as const;
  async generateVoice(input: { text: string; voice?: string }) {
    const voiceId = input.voice || "21m00Tcm4TlvDq8ikWAM";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": env("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.text, model_id: "eleven_turbo_v2_5" }),
    });
    if (!res.ok) throw new Error("Voice generation failed");
    const buf = Buffer.from(await res.arrayBuffer());
    return { audioBase64: buf.toString("base64"), mime: "audio/mpeg" };
  }
}

/* --------------------------------- image ---------------------------------- */

class MockImageProvider implements ImageProvider {
  id = "easyad-demo-graphics";
  mode = "mock" as const;
  async generateImage() {
    return {
      base64: null,
      mime: null,
      note: "Demo mode: scenes use Easy Ad's generated motion graphics instead of AI imagery.",
    };
  }
}

class GatewayImageProvider implements ImageProvider {
  id = "gemini-image";
  mode = "real" as const;
  async generateImage(input: { prompt: string; referenceImageUrl?: string }) {
    const out = await aiImage({ prompt: input.prompt, referenceImageUrl: input.referenceImageUrl });
    return { base64: out.base64, mime: out.mime };
  }
}

/* --------------------------------- media ---------------------------------- */

class DemoMediaProvider implements MediaProvider {
  id = "easyad-demo-library";
  mode = "mock" as const;
  async searchMedia(input: { businessType?: string; count: number }) {
    return pickAssetsForScenes(input.businessType, input.count);
  }
}

/* -------------------------------- registry -------------------------------- */

export function getAIProvider(): AIProvider {
  return aiEnabled() ? new GatewayAIProvider() : new MockAIProvider();
}
export function getVideoProvider(): VideoProvider {
  return falEnabled() ? new FalVideoProvider() : new MockVideoProvider();
}
export function getVoiceProvider(): VoiceProvider {
  return voiceEnabled() ? new ElevenLabsVoiceProvider() : new MockVoiceProvider();
}
export function getImageProvider(): ImageProvider {
  return aiEnabled() ? new GatewayImageProvider() : new MockImageProvider();
}
export function getMediaProvider(): MediaProvider {
  return new DemoMediaProvider();
}

export function providerStatus(): ProviderStatus {
  const video = getVideoProvider();
  const voice = getVoiceProvider();
  const image = getImageProvider();
  const ai = getAIProvider();
  const media = getMediaProvider();
  return {
    demoMode: video.mode === "mock",
    providers: [
      {
        kind: "ai",
        id: ai.id,
        mode: ai.mode,
        configured: ai.mode === "real",
        note: ai.mode === "real" ? "Scripts written by AI." : "Scripts built from Easy Ad's template engine.",
      },
      {
        kind: "video",
        id: video.id,
        mode: video.mode,
        configured: video.mode === "real",
        note:
          video.mode === "real"
            ? "AI video scenes enabled."
            : "Ads render from Easy Ad's own motion graphics. Set FAL_KEY and FAL_ENABLED=true for AI video scenes.",
      },
      {
        kind: "voice",
        id: voice.id,
        mode: voice.mode,
        configured: voice.mode === "real",
        note: voice.mode === "real" ? "AI narration enabled." : "Captions + music bed only. Add ELEVENLABS_API_KEY for narration.",
      },
      {
        kind: "image",
        id: image.id,
        mode: image.mode,
        configured: image.mode === "real",
        note: image.mode === "real" ? "AI scene imagery available." : "Generated gradients and motion graphics.",
      },
      { kind: "media", id: media.id, mode: media.mode, configured: true, note: "Built-in demo media library." },
    ],
  };
}
