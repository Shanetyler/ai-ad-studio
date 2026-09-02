// Client-safe shared types for the Easy Ad creation pipeline.

export type AspectRatio = "9:16" | "1:1" | "16:9";

export type BusinessInfo = {
  business_name: string;
  business_type: string;
  description: string;
  products: string;
  target_customer: string;
  location: string;
  phone: string;
  website: string;
  cta: string;
  offer: string;
  notes: string;
};

export const EMPTY_BUSINESS: BusinessInfo = {
  business_name: "",
  business_type: "",
  description: "",
  products: "",
  target_customer: "",
  location: "",
  phone: "",
  website: "",
  cta: "",
  offer: "",
  notes: "",
};

export const AD_TYPES = [
  "Product promotion",
  "Service promotion",
  "Local business advertisement",
  "Special offer",
  "Brand awareness",
  "Social media advertisement",
  "Website promotion",
] as const;

export const TONES = [
  "Professional",
  "Friendly",
  "Energetic",
  "Luxury",
  "Funny",
  "Bold",
  "Trustworthy",
  "Urgent",
] as const;

export const FORMATS: { id: AspectRatio; label: string; hint: string }[] = [
  { id: "9:16", label: "Vertical", hint: "TikTok / Reels / Shorts" },
  { id: "1:1", label: "Square", hint: "Feed posts" },
  { id: "16:9", label: "Landscape", hint: "YouTube / websites" },
];

export const DURATIONS = [15, 30, 45, 60] as const;

export const BUSINESS_TYPES = [
  "Landscaping",
  "Construction",
  "Cleaning",
  "Restaurant",
  "Automotive",
  "Real estate",
  "Fitness",
  "Beauty",
  "Retail",
  "Home services",
  "Professional services",
  "Other",
] as const;

export type ShotType = "business_media" | "graphics" | "ai_image" | "ai_video";

export type AdScene = {
  id: string;
  duration_s: number;
  title: string;
  description: string;
  caption: string;
  /** Media asset id from the demo library, or "upload" when image_url is set. */
  asset_id?: string;
  image_url?: string;
  /** How the creative director decided to shoot this beat. */
  shot_type?: ShotType;
  /** Signed URL of a generated/uploaded clip for this beat, when one exists. */
  video_url?: string;
};

export type AdPlan = {
  hook: string;
  scenes: AdScene[];
  cta: string;
  voiceover: string;
  music_style: string;
  captions_enabled: boolean;
  palette: { primary: string; secondary: string };
  font: "display" | "sans" | "mono";
  logo_url?: string;
  contact_line?: string;
  /** Which provider produced the visuals. */
  visuals_source: "demo" | "ai";
  /** Saved cast library selections (character / voice records). */
  character_id?: string;
  voice_id?: string;
  /** Objective + audience captured in the wizard. */
  objective?: string;
  audience?: string;
  transition?: TransitionId;
};

export type TransitionId = "cut" | "fade" | "slide" | "zoom";

export const TRANSITIONS: { id: TransitionId; label: string }[] = [
  { id: "cut", label: "Hard cut" },
  { id: "fade", label: "Cross fade" },
  { id: "slide", label: "Slide" },
  { id: "zoom", label: "Zoom punch" },
];

export type AdStyle = {
  ad_type: string;
  tone: string;
  aspect: AspectRatio;
  duration: number;
};

export const CREDITS_PER_AD = 10;
export const PLAN_CREDIT_COST = 2;
export const RENDER_CREDIT_COST = 8;

export type PricingPlan = {
  id: "free" | "starter" | "pro" | "business";
  name: string;
  price: string;
  ads: number;
  features: string[];
};

export const PRICING: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    ads: 5,
    features: ["5 ads per month", "Demo media library", "Captions + MP4 download", "Vertical, square & landscape"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9.99",
    ads: 25,
    features: ["25 ads per month", "Brand kit", "All formats & durations", "Priority rendering"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.99",
    ads: 100,
    features: ["100 ads per month", "AI visuals when connected", "Voiceover-ready workflow", "Ad series"],
  },
  {
    id: "business",
    name: "Business",
    price: "$49.99",
    ads: 500,
    features: ["500 ads per month", "Team seats", "Highest render quality", "Priority support"],
  },
];

export function dimensionsFor(aspect: AspectRatio) {
  if (aspect === "9:16") return { width: 720, height: 1280 };
  if (aspect === "1:1") return { width: 1000, height: 1000 };
  return { width: 1280, height: 720 };
}
