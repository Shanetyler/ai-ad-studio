// Server-only: turns crawled pages into a structured business profile +
// creative brief, keeping track of what was scraped vs. AI-inferred.

import { aiJson } from "@/lib/ai-gateway.server";
import type {
  BusinessProfileData,
  CreativeBrief,
  DiscoveredAsset,
  ProvenanceMap,
} from "@/lib/business-profile";
import { EMPTY_PROFILE } from "@/lib/business-profile";
import type { ExtractedPage } from "./crawl.server";

/* ----------------------------- deterministic ------------------------------ */

type JsonLdNode = Record<string, unknown>;

function flattenJsonLd(nodes: unknown[]): JsonLdNode[] {
  const out: JsonLdNode[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      const node = n as JsonLdNode;
      out.push(node);
      if (Array.isArray(node["@graph"])) (node["@graph"] as unknown[]).forEach(walk);
    }
  };
  nodes.forEach(walk);
  return out;
}

const asString = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function addressOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const a = v as JsonLdNode;
    return [a["streetAddress"], a["addressLocality"], a["addressRegion"], a["postalCode"]]
      .map(asString)
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

/** Hard facts pulled straight from the markup. These are never AI guesses. */
export function scrapedFacts(pages: ExtractedPage[]) {
  const nodes = flattenJsonLd(pages.flatMap((p) => p.jsonld));
  const business = nodes.find((n) => /Organization|LocalBusiness|Store|Restaurant|Professional/i.test(asString(n["@type"])));
  const products = nodes.filter((n) => /Product|Service|Offer/i.test(asString(n["@type"])));
  const reviews = nodes.filter((n) => /Review/i.test(asString(n["@type"])));
  const faqNodes = nodes.filter((n) => /Question/i.test(asString(n["@type"])));

  const sourceFor = (pred: (p: ExtractedPage) => boolean) => pages.find(pred)?.url;

  const phones = [...new Set([...(business ? [asString(business["telephone"])] : []), ...pages.flatMap((p) => p.phones)])].filter(Boolean);
  const emails = [...new Set([...(business ? [asString(business["email"])] : []), ...pages.flatMap((p) => p.emails)])].filter(Boolean);
  const socials = [...new Set(pages.flatMap((p) => p.socials))];

  const assets: DiscoveredAsset[] = [];
  const pushAsset = (a: DiscoveredAsset) => {
    if (!assets.some((x) => x.url === a.url)) assets.push(a);
  };
  for (const page of pages) {
    for (const img of page.images) {
      if (img.kind === "logo") pushAsset({ url: img.url, kind: "logo", page_url: page.url, alt: img.alt });
    }
  }
  for (const page of pages) {
    for (const img of page.images) {
      if (img.kind === "image") pushAsset({ url: img.url, kind: "image", page_url: page.url, alt: img.alt });
      if (assets.length >= 24) break;
    }
  }

  return {
    name: asString(business?.["name"]),
    address: addressOf(business?.["address"]),
    phones,
    emails,
    socials,
    productNames: products.map((p) => asString(p["name"])).filter(Boolean).slice(0, 12),
    reviews: reviews
      .map((r) => ({
        quote: asString((r["reviewBody"] as string) ?? r["description"]),
        author: asString((r["author"] as JsonLdNode | string | undefined) && typeof r["author"] === "object" ? (r["author"] as JsonLdNode)["name"] : r["author"]),
        rating: Number(asString((r["reviewRating"] as JsonLdNode | undefined)?.["ratingValue"])) || undefined,
        source_url: sourceFor((p) => p.jsonld.length > 0),
      }))
      .filter((r) => r.quote)
      .slice(0, 8),
    faqs: faqNodes
      .map((q) => ({
        question: asString(q["name"]),
        answer: asString((q["acceptedAnswer"] as JsonLdNode | undefined)?.["text"]).replace(/<[^>]+>/g, " ").trim(),
        source_url: sourceFor((p) => p.page_type === "faq"),
      }))
      .filter((f) => f.question && f.answer)
      .slice(0, 10),
    assets,
    contactUrl: sourceFor((p) => p.page_type === "contact"),
    pricingUrl: sourceFor((p) => p.page_type === "pricing"),
  };
}

/* ------------------------------ AI consolidation --------------------------- */

type AiOut = {
  profile: Partial<BusinessProfileData>;
  brief: Partial<CreativeBrief>;
  /** Field name -> source page URL, for fields the model read off a page. */
  sources?: Record<string, string>;
};

function corpus(pages: ExtractedPage[]) {
  return pages
    .map(
      (p) =>
        `### ${p.page_type.toUpperCase()} — ${p.url}\nTITLE: ${p.title}\nMETA: ${p.meta_description}\nHEADINGS: ${p.headings
          .slice(0, 18)
          .join(" | ")}\nTEXT: ${p.text.slice(0, 3500)}`,
    )
    .join("\n\n")
    .slice(0, 60_000);
}

const SYSTEM = `You are a senior brand and business analyst preparing an advertising brief.
You are given text scraped from a company's own website. Rules:
- Only put information into "profile" that is genuinely supported by the page text. Never invent a phone number, price, address, review or claim.
- If a profile field is not supported by the pages, return it as an empty string or empty array.
- "brief" is where your creative judgement belongs (angles, hooks, objections, tone).
- For each profile field you filled from a page, record which URL it came from in "sources".
Return strict JSON only.`;

export async function buildProfile(pages: ExtractedPage[], websiteUrl: string) {
  const facts = scrapedFacts(pages);
  const profile: BusinessProfileData = { ...EMPTY_PROFILE };
  const provenance: ProvenanceMap = {};

  // Deterministic facts first — highest confidence.
  const home = pages[0];
  if (facts.name || home?.title) {
    profile.business_name = facts.name || home!.title.split(/[|\-–—]/)[0]!.trim();
    provenance["business_name"] = {
      origin: "scraped",
      source_url: facts.name ? home?.url : home?.url,
      confidence: facts.name ? 0.95 : 0.7,
    };
  }
  if (facts.phones[0]) {
    profile.phone = facts.phones[0]!;
    provenance["phone"] = { origin: "scraped", source_url: facts.contactUrl ?? home?.url, confidence: 0.85 };
  }
  if (facts.emails[0]) {
    profile.email = facts.emails[0]!;
    provenance["email"] = { origin: "scraped", source_url: facts.contactUrl ?? home?.url, confidence: 0.85 };
  }
  if (facts.socials.length) {
    profile.socials = facts.socials;
    provenance["socials"] = { origin: "scraped", source_url: home?.url, confidence: 0.95 };
  }
  if (facts.address) {
    profile.locations = [{ address: facts.address, source_url: facts.contactUrl ?? home?.url }];
    provenance["locations"] = { origin: "scraped", source_url: facts.contactUrl ?? home?.url, confidence: 0.9 };
  }
  if (facts.reviews.length) {
    profile.testimonials = facts.reviews;
    provenance["testimonials"] = { origin: "scraped", source_url: home?.url, confidence: 0.9 };
  }
  if (facts.faqs.length) {
    profile.faqs = facts.faqs;
    provenance["faqs"] = { origin: "scraped", source_url: facts.faqs[0]?.source_url ?? home?.url, confidence: 0.9 };
  }

  let brief: CreativeBrief = {
    objective: "Get more enquiries",
    audience: "",
    angles: [],
    hooks: [],
    proof_points: [],
    objections: [],
    tone: "Professional",
    must_say: [],
    avoid: [],
  };

  if (pages.length) {
    try {
      const out = await aiJson<AiOut>({
        system: SYSTEM,
        prompt: `Website: ${websiteUrl}
Pages scanned: ${pages.map((p) => `${p.page_type}:${p.url}`).join(", ")}

${corpus(pages)}

Return JSON exactly:
{
 "profile": {
   "business_name": string, "business_type": string, "one_liner": string, "description": string,
   "offerings": [{"name": string, "description": string, "price": string, "source_url": string}],
   "offers": string[], "usps": string[], "brand_voice": string, "brand_words": string[],
   "target_customer": string, "cta": string, "primary_color": string, "secondary_color": string,
   "locations": [{"label": string, "address": string, "service_area": string, "source_url": string}],
   "testimonials": [{"quote": string, "author": string, "source_url": string}],
   "faqs": [{"question": string, "answer": string, "source_url": string}]
 },
 "brief": {
   "objective": string, "audience": string, "angles": string[], "hooks": string[],
   "proof_points": string[], "objections": string[], "tone": string, "must_say": string[], "avoid": string[]
 },
 "sources": { "<profile field>": "<url>" }
}
Max 6 offerings, 5 offers, 6 usps, 5 hooks, 4 angles, 6 faqs, 6 testimonials.`,
      });

      const p = out.profile ?? {};
      const take = <K extends keyof BusinessProfileData>(key: K, value: BusinessProfileData[K] | undefined, empty: boolean) => {
        if (value === undefined || value === null) return;
        const isEmpty = Array.isArray(value) ? value.length === 0 : !String(value).trim();
        if (isEmpty) return;
        if (!empty) return; // keep the scraped value
        profile[key] = value;
        const src = out.sources?.[key as string];
        provenance[key as string] = src
          ? { origin: "scraped", source_url: src, confidence: 0.7 }
          : { origin: "ai", confidence: 0.5 };
      };

      take("business_name", p.business_name, !profile.business_name);
      take("business_type", p.business_type, true);
      take("one_liner", p.one_liner, true);
      take("description", p.description, true);
      take("offerings", p.offerings?.slice(0, 6), true);
      take("offers", p.offers?.slice(0, 5), true);
      take("usps", p.usps?.slice(0, 6), true);
      take("brand_voice", p.brand_voice, true);
      take("brand_words", p.brand_words?.slice(0, 12), true);
      take("target_customer", p.target_customer, true);
      take("cta", p.cta, true);
      take("primary_color", p.primary_color, true);
      take("secondary_color", p.secondary_color, true);
      take("locations", p.locations, profile.locations.length === 0);
      take("testimonials", p.testimonials?.slice(0, 6), profile.testimonials.length === 0);
      take("faqs", p.faqs?.slice(0, 6), profile.faqs.length === 0);

      brief = { ...brief, ...(out.brief ?? {}) } as CreativeBrief;
    } catch (err) {
      // AI consolidation is best-effort: scraped facts still make a usable profile.
      provenance["_ai_error"] = { origin: "ai", confidence: 0 };
      void err;
    }
  }

  if (!profile.business_name) profile.business_name = new URL(websiteUrl).hostname.replace(/^www\./, "");
  if (!profile.offerings.length && facts.productNames.length) {
    profile.offerings = facts.productNames.map((n) => ({ name: n, description: "", source_url: home?.url }));
    provenance["offerings"] = { origin: "scraped", source_url: home?.url, confidence: 0.8 };
  }

  return { profile, brief, provenance, assets: facts.assets };
}
