// Server-only Firecrawl deep crawl. Runs through the Lovable connector gateway,
// so no Firecrawl credential ever reaches the browser.
//
// Firecrawl is only used to *fetch* pages. Easy Ad still enforces its own
// safety policy on every URL: same-origin only, robots.txt respected, no
// private hosts, and the same hard page / byte / time caps as the direct
// crawler. Extraction and provenance stay in our own pipeline.

import {
  CRAWL_LIMITS,
  classifyPage,
  extractPage,
  fetchRobots,
  isSafePublicUrl,
  pageScore,
  robotsAllows,
  type CrawlResult,
  type ExtractedPage,
} from "./crawl.server";
import type { PageType } from "@/lib/business-profile";

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

const env = (name: string) => process.env[name]?.trim() || "";

/** True when the connected Firecrawl integration is actually usable server-side. */
export function firecrawlAvailable() {
  return Boolean(env("FIRECRAWL_API_KEY") && env("LOVABLE_API_KEY"));
}

async function firecrawl<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": env("FIRECRAWL_API_KEY"),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      message = parsed.error ?? parsed.message ?? message;
    } catch {
      /* keep raw text */
    }
    if (res.status === 402 || (res.status === 403 && /credit/i.test(message))) {
      throw new Error(`Firecrawl credits exhausted: ${message}`);
    }
    throw new Error(`Firecrawl ${res.status}: ${message}`);
  }
  return JSON.parse(text) as T;
}

type MapResponse = { links?: Array<string | { url?: string }>; data?: { links?: string[] } };
type ScrapeResponse = {
  rawHtml?: string;
  html?: string;
  data?: { rawHtml?: string; html?: string };
};

async function mapSite(url: string, limit: number): Promise<string[]> {
  const out = await firecrawl<MapResponse>("/map", { url, limit, includeSubdomains: false }, 20_000);
  const raw = out.links ?? out.data?.links ?? [];
  return raw
    .map((l) => (typeof l === "string" ? l : l?.url))
    .filter((u): u is string => typeof u === "string" && u.length > 0);
}

async function scrapePage(url: string): Promise<string | null> {
  try {
    const out = await firecrawl<ScrapeResponse>(
      "/scrape",
      { url, formats: ["rawHtml"], onlyMainContent: false },
      30_000,
    );
    return out.rawHtml ?? out.html ?? out.data?.rawHtml ?? out.data?.html ?? null;
  } catch {
    return null;
  }
}

/**
 * Deep crawl through Firecrawl. Throws if Firecrawl itself is unusable so the
 * caller can fall back to the built-in crawler.
 */
export async function crawlSiteWithFirecrawl(
  startUrl: string,
  maxPages = CRAWL_LIMITS.maxPages,
): Promise<CrawlResult> {
  const safe = isSafePublicUrl(startUrl);
  if (!safe.ok || !safe.url) throw new Error(safe.reason ?? "Unsafe URL");
  const start = safe.url;
  const origin = start.origin;
  const deadline = Date.now() + CRAWL_LIMITS.totalTimeMs;
  const robots = await fetchRobots(origin);

  const skipped: string[] = [];
  const pages: ExtractedPage[] = [];
  const seen = new Set<string>();

  const keyOf = (u: URL) => u.toString().replace(/\/$/, "");

  const take = async (url: URL, type: PageType) => {
    const key = keyOf(url);
    if (seen.has(key) || pages.length >= maxPages || Date.now() > deadline) return;
    seen.add(key);
    if (!robotsAllows(robots, url.pathname)) {
      skipped.push(`${url.pathname} (blocked by robots.txt)`);
      return;
    }
    const html = await scrapePage(url.toString());
    if (!html) {
      skipped.push(`${url.pathname} (not fetchable)`);
      return;
    }
    pages.push(extractPage(html.slice(0, CRAWL_LIMITS.maxBytesPerPage), url, type));
  };

  // The landing page must come through Firecrawl for this to count as a Firecrawl scan.
  const homeHtml = await scrapePage(start.toString());
  if (!homeHtml) throw new Error("Firecrawl could not read the landing page.");
  seen.add(keyOf(start));
  pages.push(extractPage(homeHtml.slice(0, CRAWL_LIMITS.maxBytesPerPage), start, classifyPage(start)));

  // Candidate pages: Firecrawl's site map, then links found on the landing page.
  const candidates = new Map<string, { url: URL; type: PageType; score: number }>();
  const consider = (raw: string, anchor = "") => {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return;
    }
    url.hash = "";
    url.search = "";
    // Easy Ad policy: only keep pages from the target site's own origin.
    if (url.origin !== origin) return;
    if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|mp4|css|js|xml|ico)$/i.test(url.pathname)) return;
    const key = keyOf(url);
    if (seen.has(key) || candidates.has(key)) return;
    const type = classifyPage(url, anchor);
    if (type === "blog") return;
    const depthPenalty = url.pathname.split("/").filter(Boolean).length * 2;
    candidates.set(key, { url, type, score: pageScore(type) - depthPenalty });
  };

  try {
    for (const link of await mapSite(start.toString(), 200)) consider(link);
  } catch (err) {
    // /map is optional: link discovery from the landing page still works.
    skipped.push(`sitemap discovery unavailable (${String(err).slice(0, 80)})`);
  }
  for (const link of pages[0]?.links ?? []) consider(link.url, link.anchor);

  const ordered = [...candidates.values()].sort((a, b) => b.score - a.score);
  const usedTypes = new Set<PageType>(pages.map((p) => p.page_type));
  const diverse = ordered.filter((c) => !usedTypes.has(c.type) && (usedTypes.add(c.type), true));
  const rest = ordered.filter((c) => !diverse.includes(c));

  for (const c of [...diverse, ...rest]) {
    if (pages.length >= maxPages || Date.now() > deadline) break;
    await take(c.url, c.type);
  }

  return { pages, skipped };
}
