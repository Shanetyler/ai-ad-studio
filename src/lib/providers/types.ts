// Provider interfaces. Everything in Easy Ad's generation pipeline goes through
// one of these so a real paid provider can be swapped in later without touching
// the product code.

import type { AdPlan, AdStyle, BusinessInfo } from "@/lib/ad-types";

export type ProviderMode = "mock" | "real";

export type ProviderInfo = {
  kind: "ai" | "video" | "voice" | "image" | "media";
  id: string;
  mode: ProviderMode;
  configured: boolean;
  note: string;
};

export type ProviderStatus = {
  demoMode: boolean;
  providers: ProviderInfo[];
};

export interface AIProvider {
  id: string;
  mode: ProviderMode;
  generateAdScript(input: { business: BusinessInfo; style: AdStyle; brandTone?: string }): Promise<AdPlan>;
}

export type SceneJob = { id: string; status: "queued" | "running" | "succeeded" | "failed"; url?: string; error?: string };

export interface VideoProvider {
  id: string;
  mode: ProviderMode;
  /** Ask the provider for a single AI video scene. Mock returns a demo-media instruction. */
  generateScene(input: { prompt: string; aspect: string; duration: number; imageUrl?: string }): Promise<SceneJob>;
  getGenerationStatus(id: string): Promise<SceneJob>;
  downloadVideo(id: string): Promise<{ url: string | null }>;
}

export interface VoiceProvider {
  id: string;
  mode: ProviderMode;
  /** Returns audio for the voiceover, or null when running in demo mode. */
  generateVoice(input: { text: string; voice?: string }): Promise<{ audioBase64: string | null; mime: string | null; note?: string }>;
}

export interface ImageProvider {
  id: string;
  mode: ProviderMode;
  generateImage(input: { prompt: string; referenceImageUrl?: string }): Promise<{ base64: string | null; mime: string | null; note?: string }>;
}

export interface MediaProvider {
  id: string;
  mode: ProviderMode;
  searchMedia(input: { businessType?: string; count: number }): Promise<string[]>;
}
