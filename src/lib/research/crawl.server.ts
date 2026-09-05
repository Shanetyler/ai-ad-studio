// Server-only website crawler used by the deep business scan.
// Hard safety rules: same-origin only, robots.txt respected, no private
// networks, capped page count / byte size / total time.

import type { PageType } from "@/lib/business-profile";

export const CRAWL_LIMITS = {
  maxPages: 10,
  maxBytesPerPage: 1_500_000,
  requestTimeoutMs: 8000,
  totalTimeMs: 45_000,
  maxTextPerPage: 6000,
};

const UA = "EasyAdsBot/1.0 (+https://easyads.app)";

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd])/i;

export function isSafePublicUrl(raw: string): { ok: boolean; url?: URL; reason?: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "That does not look like a valid URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) websites can be scanned." };
  }
  if (PRIVATE_HOST.test(url.hostname)) {
    return { ok: false, reason: "Private or local addresses cannot be scanned." };
  }
  if (!url.hostname.includes(".")) {
    return { ok: false, reason: "Enter a public website address." };
  }
  return { ok: true, url };
}

/* --------------------------------- robots --------------------------------- */

type Robots = { disallow: string[] };

export async function fetchRobots(origin: string): Promise<Robots> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(CRAWL_LIMITS.requestTimeoutMs),
    });
    if (!res.ok) return { disallow: [] };
    const text = (await res.text()).slice(0, 100_000);
    const disallow: string[] = [];
    let applies = false;
    for (const line of text.split(/\r?\n/)) {
      const [rawKey, ...rest] = line.split("#")[0]!.split(":");
      if (!rawKey || rest.length === 0) continue;
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (key === "user-agent") applies = value === "*" || value.toLowerCase().includes("easyads");
      else if (key === "disallow" && applies && value) disallow.push(value);
    }
    return { disallow };
  } catch {
    return { disallow: [] };
  }
}

export function robotsAllows(robots: Robots, pathname: string) {
  return !robots.disallow.some((rule) => rule === "/" || (rule.length > 1 && pathname.startsWith(rule)));
}

/* -------------------------------- extraction ------------------------------- */

export type ExtractedPage = {
  url: string;
  page_type: PageType;
  title: string;
  meta_description: string;
  headings: string[];
  text: string;
  jsonld: unknown[];
  phones: string[];
  emails: string[];
  socials: string[];
  images: { url: string; alt: string; kind: "logo" | "image" }[];
  links: { url: string; anchor: string }[];
};

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const TYPE_RULES: Array<[PageType, RegExp]> = [
  ["about", /about|our-story|who-we-are|team|company/i],
  ["services", /service|solutions|what-we-do|treatments|repairs/i],
  ["products", /product|shop|store|menu|catalog|collections/i],
  ["pricing", /pricing|prices|plans|rates|packages|quote/i],
  ["contact", /contact|get-in-touch|book|appointment|estimate/i],
  ["testimonials", /testimonial|review|customers|case-stud|success/i],
  ["faq", /faq|frequently-asked|questions|help/i],
  ["locations", /location|areas|service-area|branches|find-us/i],
  ["blog", /blog|news|articles|posts/i],
];

export function classifyPage(url: URL, anchor = ""): PageType {
  if (url.pathname === "/" || url.pathname === "") return "home";
  const probe = `${url.pathname} ${anchor}`;
  for (const [type, re] of TYPE_RULES) if (re.test(probe)) return type;
  return "other";
}

export function extractPage(html: string, url: URL, pageType: PageType): ExtractedPage {
  const jsonld: unknown[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonld.push(JSON.parse(m[1]!.trim()));
    } catch {
      /* ignore malformed json-ld */
    }
  }

  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "").slice(0, 200);
  const meta_description = decode(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
      "",
  ).slice(0, 400);

  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => decode(m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()))
    .filter((h) => h.length > 1)
    .slice(0, 40);

  const abs = (href: string) => {
    try {
      return new URL(href, url).toString();
    } catch {
      return null;
    }
  };

  const images: ExtractedPage["images"] = [];
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogImage) {
    const u = abs(ogImage);
    if (u) images.push({ url: u, alt: "Open Graph image", kind: "image" });
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1];
    if (!src || src.startsWith("data:")) continue;
    const u = abs(src);
    if (!u) continue;
    const alt = decode(tag.match(/\balt=["']([^"']*)["']/i)?.[1] ?? "");
    const isLogo = /logo|brandmark|wordmark/i.test(`${src} ${alt} ${tag.match(/class=["']([^"']*)["']/i)?.[1] ?? ""}`);
    images.push({ url: u, alt, kind: isLogo ? "logo" : "image" });
    if (images.length >= 30) break;
  }

  const links: ExtractedPage["links"] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const u = abs(m[1]!);
    if (!u) continue;
    const anchor = decode(m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 120);
    links.push({ url: u, anchor });
    if (links.length >= 400) break;
  }

  const socials = [
    ...new Set(
      links
        .map((l) => l.url)
        .filter((u) => /facebook\.com|instagram\.com|tiktok\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com/i.test(u))
        .slice(0, 12),
    ),
  ];

  const text = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CRAWL_LIMITS.maxTextPerPage);

  const phones = [
    ...new Set(
      (text.match(/(\+?\d[\d\s().-]{7,17}\d)/g) ?? [])
        .map((p) => p.trim())
        .filter((p) => (p.replace(/\D/g, "").length >= 9 && p.replace(/\D/g, "").length <= 15))
        .slice(0, 5),
    ),
  ];
  const emails = [...new Set((text.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) ?? []).slice(0, 5))];

  return {
    url: url.toString(),
    page_type: pageType,
    title,
    meta_description,
    headings,
    text,
    jsonld,
    phones,
    emails,
    socials,
    images: images.slice(0, 20),
    links,
  };
}

/* --------------------------------- crawl ---------------------------------- */

async function fetchHtml(url: URL): Promise<string | null> {
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(CRAWL_LIMITS.requestTimeoutMs),
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ctype)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > CRAWL_LIMITS.maxBytesPerPage) {
      return new TextDecoder().decode(buf.slice(0, CRAWL_LIMITS.maxBytesPerPage));
    }
    return new TextDecoder().decode(buf);
  } catch {
    return null;
  }
}

async function sitemapUrls(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(CRAWL_LIMITS.requestTimeoutMs),
    });
    if (!res.ok) return [];
    const xml = (await res.text()).slice(0, 400_000);
    return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!).slice(0, 200);
  } catch {
    return [];
  }
}

/** Scores a candidate page: higher = more useful for a creative brief. */
export function pageScore(type: PageType) {
  const order: PageType[] = [
    "home",
    "services",
    "products",
    "about",
    "pricing",
    "testimonials",
    "contact",
    "faq",
    "locations",
    "other",
    "blog",
  ];
  const i = order.indexOf(type);
  return 100 - (i < 0 ? 99 : i * 5);
}


export type CrawlResult = { pages: ExtractedPage[]; skipped: string[] };

/** Deep crawl: home page plus the most relevant same-origin pages. */
export async function crawlSite(startUrl: string, maxPages = CRAWL_LIMITS.maxPages): Promise<CrawlResult> {
  const safe = isSafePublicUrl(startUrl);
  if (!safe.ok || !safe.url) throw new Error(safe.reason ?? "Unsafe URL");
  const start = safe.url;
  const origin = start.origin;
  const deadline = Date.now() + CRAWL_LIMITS.totalTimeMs;
  const robots = await fetchRobots(origin);

  const seen = new Set<string>();
  const skipped: string[] = [];
  const pages: ExtractedPage[] = [];

  const clean = (u: string) => {
    try {
      const url = new URL(u);
      url.hash = "";
      url.search = "";
      return url;
    } catch {
      return null;
    }
  };

  const visit = async (url: URL, type: PageType) => {
    const key = url.toString().replace(/\/$/, "");
    if (seen.has(key) || pages.length >= maxPages || Date.now() > deadline) return;
    seen.add(key);
    if (!robotsAllows(robots, url.pathname)) {
      skipped.push(`${url.pathname} (blocked by robots.txt)`);
      return;
    }
    const html = await fetchHtml(url);
    if (!html) {
      skipped.push(`${url.pathname} (not fetchable)`);
      return;
    }
    pages.push(extractPage(html, url, type));
  };

  await visit(start, classifyPage(start));
  const home = pages[0];

  const candidates = new Map<string, { url: URL; type: PageType; score: number }>();
  const consider = (raw: string, anchor = "") => {
    const url = clean(raw);
    if (!url || url.origin !== origin) return;
    if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|mp4|css|js|xml|ico)$/i.test(url.pathname)) return;
    const key = url.toString().replace(/\/$/, "");
    if (seen.has(key) || candidates.has(key)) return;
    const type = classifyPage(url, anchor);
    if (type === "blog") return;
    const depthPenalty = url.pathname.split("/").filter(Boolean).length * 2;
    candidates.set(key, { url, type, score: score(type) - depthPenalty });
  };

  for (const link of home?.links ?? []) consider(link.url, link.anchor);
  if (candidates.size < maxPages) for (const loc of await sitemapUrls(origin)) consider(loc);

  const ordered = [...candidates.values()].sort((a, b) => b.score - a.score);
  // Prefer type diversity: one page per type first, then fill remaining slots.
  const usedTypes = new Set<PageType>(pages.map((p) => p.page_type));
  const diverse = ordered.filter((c) => !usedTypes.has(c.type) && (usedTypes.add(c.type), true));
  const rest = ordered.filter((c) => !diverse.includes(c));
  for (const c of [...diverse, ...rest]) {
    if (pages.length >= maxPages || Date.now() > deadline) break;
    await visit(c.url, c.type);
  }

  return { pages, skipped };
}

/** Quick path: single page, same extraction pipeline. */
export async function crawlSinglePage(startUrl: string): Promise<CrawlResult> {
  return crawlSite(startUrl, 1);
}
