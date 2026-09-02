// Client-safe types for the deep website intelligence system.

export type PageType =
  | "home"
  | "about"
  | "services"
  | "products"
  | "pricing"
  | "contact"
  | "testimonials"
  | "faq"
  | "locations"
  | "blog"
  | "other";

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  home: "Home",
  about: "About",
  services: "Services",
  products: "Products",
  pricing: "Pricing",
  contact: "Contact",
  testimonials: "Testimonials",
  faq: "FAQ",
  locations: "Locations",
  blog: "Blog",
  other: "Other",
};

/** Where a piece of information came from. */
export type Provenance = {
  /** "scraped" facts came from the site itself, "ai" values were inferred. */
  origin: "scraped" | "ai";
  source_url?: string;
  confidence?: number;
};

export type Offering = {
  name: string;
  description: string;
  price?: string;
  source_url?: string;
  ai_suggested?: boolean;
};

export type Testimonial = {
  quote: string;
  author?: string;
  rating?: number;
  source_url?: string;
};

export type FaqItem = { question: string; answer: string; source_url?: string };

export type BusinessLocation = {
  label?: string;
  address?: string;
  service_area?: string;
  source_url?: string;
};

export type DiscoveredAsset = {
  url: string;
  kind: "logo" | "image";
  page_url?: string;
  alt?: string;
  /** Set once the owner imports it into Easy Ad storage. */
  imported_url?: string;
};

export type BusinessProfileData = {
  business_name: string;
  business_type: string;
  one_liner: string;
  description: string;
  offerings: Offering[];
  offers: string[];
  locations: BusinessLocation[];
  usps: string[];
  testimonials: Testimonial[];
  faqs: FaqItem[];
  brand_voice: string;
  brand_words: string[];
  target_customer: string;
  phone: string;
  email: string;
  socials: string[];
  primary_color?: string;
  secondary_color?: string;
  cta: string;
};

export type CreativeBrief = {
  objective: string;
  audience: string;
  angles: string[];
  hooks: string[];
  proof_points: string[];
  objections: string[];
  tone: string;
  must_say: string[];
  avoid: string[];
};

export type ProvenanceMap = Record<string, Provenance>;

export const EMPTY_PROFILE: BusinessProfileData = {
  business_name: "",
  business_type: "",
  one_liner: "",
  description: "",
  offerings: [],
  offers: [],
  locations: [],
  usps: [],
  testimonials: [],
  faqs: [],
  brand_voice: "",
  brand_words: [],
  target_customer: "",
  phone: "",
  email: "",
  socials: [],
  cta: "",
};

export type BusinessProfileRow = {
  id: string;
  website_url: string;
  scan_depth: string;
  status: string;
  pages_scanned: number;
  profile_json: BusinessProfileData;
  brief_json: CreativeBrief;
  provenance_json: ProvenanceMap;
  assets_json: DiscoveredAsset[];
  brand_id: string | null;
  error: string | null;
  confirmed_at: string | null;
  created_at: string;
};

/** Maps a confirmed business profile onto the ad wizard's BusinessInfo shape. */
export function profileToBusinessInfo(p: BusinessProfileData) {
  const products = p.offerings
    .slice(0, 6)
    .map((o) => o.name)
    .filter(Boolean)
    .join(", ");
  return {
    business_name: p.business_name,
    business_type: p.business_type,
    description: p.one_liner || p.description,
    products,
    target_customer: p.target_customer,
    location: p.locations[0]?.address || p.locations[0]?.service_area || "",
    phone: p.phone,
    website: "",
    cta: p.cta,
    offer: p.offers[0] ?? "",
    notes: [p.usps.slice(0, 4).join(" • "), p.testimonials[0]?.quote ? `Review: "${p.testimonials[0]!.quote}"` : ""]
      .filter(Boolean)
      .join("\n"),
  };
}
