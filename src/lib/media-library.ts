// Easy Ad demo media library.
//
// Every asset here is generated procedurally by our own canvas renderer
// (animated gradients + vector motion graphics we draw ourselves), so there is
// no third-party or copyrighted footage involved. Assets are selected by
// business category so a landscaper gets lawn/garden motifs, a restaurant gets
// food motifs, and so on.

export type MotifId =
  | "lawn"
  | "leaf"
  | "house"
  | "blueprint"
  | "sparkle"
  | "bubbles"
  | "plate"
  | "coffee"
  | "car"
  | "road"
  | "keys"
  | "dumbbell"
  | "pulse"
  | "scissors"
  | "bag"
  | "tag"
  | "wrench"
  | "briefcase"
  | "chart";

export type MediaAsset = {
  id: string;
  category: string;
  type: "generated";
  /** Rendering recipe used by the canvas renderer. */
  motif: MotifId;
  palette: [string, string];
  duration: number;
  orientation: "any";
  tags: string[];
  label: string;
};

export const MEDIA_ASSETS: MediaAsset[] = [
  // Landscaping
  { id: "land-lawn", category: "Landscaping", type: "generated", motif: "lawn", palette: ["#0f2f1c", "#4ade80"], duration: 6, orientation: "any", tags: ["lawn", "grass", "yard"], label: "Fresh cut lawn" },
  { id: "land-garden", category: "Landscaping", type: "generated", motif: "leaf", palette: ["#12281f", "#a3e635"], duration: 6, orientation: "any", tags: ["garden", "plants"], label: "Garden greens" },
  // Construction
  { id: "con-frame", category: "Construction", type: "generated", motif: "blueprint", palette: ["#111827", "#f59e0b"], duration: 6, orientation: "any", tags: ["build", "plans"], label: "Blueprint build" },
  { id: "con-tools", category: "Construction", type: "generated", motif: "wrench", palette: ["#1c1917", "#fbbf24"], duration: 6, orientation: "any", tags: ["tools", "repair"], label: "Tools at work" },
  // Cleaning
  { id: "clean-shine", category: "Cleaning", type: "generated", motif: "bubbles", palette: ["#082f49", "#38bdf8"], duration: 6, orientation: "any", tags: ["clean", "shine"], label: "Sparkling clean" },
  { id: "clean-home", category: "Cleaning", type: "generated", motif: "house", palette: ["#0c2540", "#67e8f9"], duration: 6, orientation: "any", tags: ["home", "tidy"], label: "Spotless home" },
  // Restaurant
  { id: "food-plate", category: "Restaurant", type: "generated", motif: "plate", palette: ["#2a0f0a", "#fb923c"], duration: 6, orientation: "any", tags: ["food", "dish"], label: "Signature plate" },
  { id: "food-coffee", category: "Restaurant", type: "generated", motif: "coffee", palette: ["#231409", "#f59e0b"], duration: 6, orientation: "any", tags: ["cafe", "coffee"], label: "Warm cafe" },
  // Automotive
  { id: "auto-car", category: "Automotive", type: "generated", motif: "car", palette: ["#0b1220", "#60a5fa"], duration: 6, orientation: "any", tags: ["car", "dealer"], label: "Showroom car" },
  { id: "auto-road", category: "Automotive", type: "generated", motif: "road", palette: ["#111827", "#f87171"], duration: 6, orientation: "any", tags: ["drive", "road"], label: "Open road" },
  // Real estate
  { id: "re-home", category: "Real estate", type: "generated", motif: "house", palette: ["#12212f", "#facc15"], duration: 6, orientation: "any", tags: ["listing", "home"], label: "Featured listing" },
  { id: "re-keys", category: "Real estate", type: "generated", motif: "keys", palette: ["#1a1a2e", "#a78bfa"], duration: 6, orientation: "any", tags: ["keys", "sold"], label: "Keys in hand" },
  // Fitness
  { id: "fit-lift", category: "Fitness", type: "generated", motif: "dumbbell", palette: ["#101010", "#f43f5e"], duration: 6, orientation: "any", tags: ["gym", "training"], label: "Training floor" },
  { id: "fit-pulse", category: "Fitness", type: "generated", motif: "pulse", palette: ["#0b1020", "#22d3ee"], duration: 6, orientation: "any", tags: ["energy", "results"], label: "Energy pulse" },
  // Beauty
  { id: "beauty-salon", category: "Beauty", type: "generated", motif: "scissors", palette: ["#26121f", "#f472b6"], duration: 6, orientation: "any", tags: ["salon", "hair"], label: "Salon chair" },
  { id: "beauty-glow", category: "Beauty", type: "generated", motif: "sparkle", palette: ["#1f1030", "#e879f9"], duration: 6, orientation: "any", tags: ["glow", "spa"], label: "Glow up" },
  // Retail
  { id: "retail-bag", category: "Retail", type: "generated", motif: "bag", palette: ["#111827", "#34d399"], duration: 6, orientation: "any", tags: ["shop", "store"], label: "Shopping bag" },
  { id: "retail-sale", category: "Retail", type: "generated", motif: "tag", palette: ["#1b0f2b", "#fb7185"], duration: 6, orientation: "any", tags: ["sale", "offer"], label: "Price tag" },
  // Home services
  { id: "home-fix", category: "Home services", type: "generated", motif: "wrench", palette: ["#0f172a", "#38bdf8"], duration: 6, orientation: "any", tags: ["repair", "service"], label: "On-site service" },
  { id: "home-visit", category: "Home services", type: "generated", motif: "house", palette: ["#121c2b", "#facc15"], duration: 6, orientation: "any", tags: ["home", "visit"], label: "House call" },
  // Professional services
  { id: "pro-case", category: "Professional services", type: "generated", motif: "briefcase", palette: ["#0b1424", "#93c5fd"], duration: 6, orientation: "any", tags: ["office", "consult"], label: "Consultation" },
  { id: "pro-growth", category: "Professional services", type: "generated", motif: "chart", palette: ["#0d1b2a", "#4ade80"], duration: 6, orientation: "any", tags: ["growth", "results"], label: "Growth chart" },
  // Universal
  { id: "any-sparkle", category: "Other", type: "generated", motif: "sparkle", palette: ["#141414", "#fbbf24"], duration: 6, orientation: "any", tags: ["general"], label: "Signature glow" },
  { id: "any-pulse", category: "Other", type: "generated", motif: "pulse", palette: ["#101828", "#818cf8"], duration: 6, orientation: "any", tags: ["general"], label: "Motion pulse" },
];

const ALIASES: Record<string, string> = {
  landscaper: "Landscaping",
  landscaping: "Landscaping",
  lawn: "Landscaping",
  contractor: "Construction",
  construction: "Construction",
  roofing: "Construction",
  cleaning: "Cleaning",
  cleaner: "Cleaning",
  maid: "Cleaning",
  restaurant: "Restaurant",
  food: "Restaurant",
  cafe: "Restaurant",
  bakery: "Restaurant",
  auto: "Automotive",
  automotive: "Automotive",
  car: "Automotive",
  dealer: "Automotive",
  realtor: "Real estate",
  "real estate": "Real estate",
  realty: "Real estate",
  gym: "Fitness",
  fitness: "Fitness",
  trainer: "Fitness",
  salon: "Beauty",
  beauty: "Beauty",
  spa: "Beauty",
  barber: "Beauty",
  retail: "Retail",
  ecommerce: "Retail",
  "e-commerce": "Retail",
  shop: "Retail",
  store: "Retail",
  plumbing: "Home services",
  hvac: "Home services",
  electrician: "Home services",
  "home services": "Home services",
  law: "Professional services",
  legal: "Professional services",
  accounting: "Professional services",
  consulting: "Professional services",
  "professional services": "Professional services",
};

export function categoryForBusiness(businessType?: string): string {
  const t = (businessType ?? "").toLowerCase().trim();
  if (!t) return "Other";
  for (const [key, cat] of Object.entries(ALIASES)) {
    if (t.includes(key)) return cat;
  }
  const direct = MEDIA_ASSETS.find((a) => a.category.toLowerCase() === t);
  return direct?.category ?? "Other";
}

export function assetsForBusiness(businessType?: string): MediaAsset[] {
  const cat = categoryForBusiness(businessType);
  const matched = MEDIA_ASSETS.filter((a) => a.category === cat);
  const universal = MEDIA_ASSETS.filter((a) => a.category === "Other");
  return matched.length ? [...matched, ...universal] : universal;
}

export function findAsset(id?: string): MediaAsset | undefined {
  return MEDIA_ASSETS.find((a) => a.id === id);
}

export function pickAssetsForScenes(businessType: string | undefined, count: number): string[] {
  const pool = assetsForBusiness(businessType);
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]!.id);
}
