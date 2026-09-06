import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { listBrands, researchBrand } from "@/lib/brand.functions";
import {
  confirmBusinessProfile,
  createBrandFromProfile,
  deepScanCapabilities,
  deleteBusinessProfile,
  getBusinessProfile,
  importDiscoveredAsset,
  listBusinessProfiles,
  scanWebsite,
  updateBusinessProfile,
} from "@/lib/business.functions";
import {
  EMPTY_PROFILE,
  PAGE_TYPE_LABELS,
  type BusinessProfileData,
  type BusinessProfileRow,
  type DiscoveredAsset,
  type PageType,
  type ProvenanceMap,
} from "@/lib/business-profile";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  Globe,
  Loader2,
  Radar,
  RefreshCw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/brands")({
  head: () => ({
    meta: [
      { title: "Business Intelligence & Brands — Easy Ad" },
      {
        name: "description",
        content:
          "Scan your website to build a verified business profile and creative brief, then turn it into a reusable brand kit for ads.",
      },
      { property: "og:title", content: "Business Intelligence & Brands — Easy Ad" },
      {
        property: "og:description",
        content: "Deep website scanning that separates verified business facts from AI suggestions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrandsPage,
});

type ProfileRow = BusinessProfileRow;

function asProfileRow(row: unknown): ProfileRow {
  return row as ProfileRow;
}

function statusLabel(status: string) {
  switch (status) {
    case "scanning":
      return "Scanning";
    case "ready":
      return "Needs review";
    case "confirmed":
      return "Confirmed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

/** Small pill that never lets an AI guess look like a verified business fact. */
function OriginTag({ p }: { p?: { origin: "scraped" | "ai"; source_url?: string } }) {
  if (!p) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Unverified
      </span>
    );
  }
  if (p.origin === "scraped") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
        <BadgeCheck className="h-3 w-3" /> From your site
        {p.source_url ? (
          <a
            href={p.source_url}
            target="_blank"
            rel="noreferrer"
            className="ml-1 underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            source
          </a>
        ) : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      <Sparkles className="h-3 w-3" /> AI suggestion
    </span>
  );
}

function BrandsPage() {
  const listFn = useServerFn(listBrands);
  const researchFn = useServerFn(researchBrand);
  const scanFn = useServerFn(scanWebsite);
  const profilesFn = useServerFn(listBusinessProfiles);
  const capsFn = useServerFn(deepScanCapabilities);
  const deleteFn = useServerFn(deleteBusinessProfile);
  const qc = useQueryClient();

  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<null | "quick" | "deep">(null);
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: () => listFn() });
  const { data: caps } = useQuery({ queryKey: ["deep-scan-caps"], queryFn: () => capsFn() });
  const {
    data: profiles = [],
    isLoading: loadingProfiles,
    error: profilesError,
  } = useQuery({ queryKey: ["business-profiles"], queryFn: () => profilesFn() });

  useEffect(() => {
    if (!busy) {
      setStatus("");
      return;
    }
    const steps =
      busy === "deep"
        ? [
            "Checking the address and robots rules…",
            "Discovering your key pages…",
            "Reading home, about, services and contact pages…",
            "Pulling out facts, offers and reviews…",
            "Writing your creative brief…",
          ]
        : ["Reading your landing page…", "Extracting brand tone and colours…"];
    let i = 0;
    setStatus(steps[0]!);
    const t = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setStatus(steps[i]!);
    }, 4500);
    return () => clearInterval(t);
  }, [busy]);

  async function onQuick() {
    if (!/^https?:\/\//i.test(url)) return toast.error("Enter a full address (https://…)");
    setBusy("quick");
    try {
      const res = await researchFn({ data: { url } });
      toast.success(`Brand created: ${res.brand.name}`);
      setUrl("");
      qc.invalidateQueries({ queryKey: ["brands"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Quick scan failed");
    } finally {
      setBusy(null);
    }
  }

  async function onDeep() {
    if (!url.trim()) return toast.error("Enter your website address first");
    setBusy("deep");
    try {
      const res = await scanFn({ data: { url: url.trim(), depth: "deep" } });
      const row = asProfileRow(res.profile);
      toast.success(
        `Scanned ${row.pages_scanned} page${row.pages_scanned === 1 ? "" : "s"}${
          res.crawler === "firecrawl" ? " with Firecrawl" : ""
        }. Review the details below.`,
      );
      setUrl("");
      setOpenId(row.id);
      qc.invalidateQueries({ queryKey: ["business-profiles"] });
      qc.invalidateQueries({ queryKey: ["credit-balance"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deep scan failed");
    } finally {
      setBusy(null);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteFn({ data: { id } });
      if (openId === id) setOpenId(null);
      qc.invalidateQueries({ queryKey: ["business-profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that profile");
    }
  }

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl">Business intelligence</h1>
        <p className="mt-1 text-muted-foreground">
          Paste your website. We read it and build the facts your ads are made from.
        </p>
      </div>

      <div className="panel mb-10 p-5 sm:p-6">
        <Label htmlFor="site-url">Website address</Label>
        <div className="relative mt-2">
          <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="site-url"
            className="pl-10"
            placeholder="https://your-business.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy !== null}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 font-medium">
              <Zap className="h-4 w-4 text-primary" /> Quick scan
              <Badge variant="secondary">Free</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reads your landing page only and saves a brand with tone, colours and ad hooks.
            </p>
            <Button className="mt-3 w-full" variant="outline" onClick={onQuick} disabled={busy !== null}>
              {busy === "quick" ? <Loader2 className="animate-spin" /> : null}
              Quick scan
            </Button>
          </div>

          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-2 font-medium">
              <Radar className="h-4 w-4 text-primary" /> Deep scan
              <Badge>{caps?.cost ?? 2} credits</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reads up to 10 of your key pages — services, pricing, contact, reviews, FAQ — and builds a
              reviewable business profile and creative brief. Costs {caps?.cost ?? 2} credits.
            </p>
            <Button className="mt-3 w-full" variant="hero" onClick={onDeep} disabled={busy !== null}>
              {busy === "deep" ? <Loader2 className="animate-spin" /> : null}
              Deep scan · {caps?.cost ?? 2} credits
            </Button>
          </div>
        </div>

        {caps ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {caps.firecrawl
              ? "Deep scan uses your connected Firecrawl service, with our own reader as backup."
              : "Firecrawl is not connected, so deep scan uses our built-in reader."}
          </p>
        ) : null}

        {busy ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{status}</span>
          </div>
        ) : null}
      </div>

      <section className="mb-12">
        <h2 className="font-display text-2xl">Saved business profiles</h2>
        {loadingProfiles ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading your profiles…</p>
        ) : profilesError ? (
          <p className="mt-3 text-sm text-destructive">
            We could not load your profiles. Refresh the page and try again.
          </p>
        ) : profiles.length === 0 ? (
          <div className="panel mt-3 p-6 text-sm text-muted-foreground">
            No profiles yet. Run a deep scan above and your reviewable business profile appears here.
          </div>
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {profiles.map((raw) => {
              const p = asProfileRow(raw);
              const name = p.profile_json?.business_name || new URL(p.website_url).hostname;
              return (
                <div key={p.id} className="panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-display text-lg">{name}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.website_url}</div>
                    </div>
                    <Badge variant={p.status === "confirmed" ? "default" : "secondary"}>
                      {statusLabel(p.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{p.pages_scanned} page(s) read</span>
                    <span>·</span>
                    <span>{p.depth === "deep" ? "Deep scan" : "Quick scan"}</span>
                    {p.brand_id ? (
                      <>
                        <span>·</span>
                        <span>Brand kit created</span>
                      </>
                    ) : null}
                  </div>
                  {p.status === "failed" && p.error ? (
                    <p className="mt-3 text-xs text-destructive">{p.error}</p>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                      {openId === p.id ? "Close" : "Review"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(p.id)}>
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {openId ? <ProfileDetail id={openId} onClosed={() => setOpenId(null)} /> : null}
      </section>

      <section>
        <h2 className="font-display text-2xl">Brand kits</h2>
        {brands.length === 0 ? (
          <div className="panel mt-3 p-6 text-sm text-muted-foreground">
            No brand kits yet. Confirm a business profile or run a quick scan to create one.
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => (
              <div key={b.id} className="panel p-6">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-md border border-border"
                    style={{
                      background:
                        b.primary_color && b.secondary_color
                          ? `linear-gradient(135deg, ${b.primary_color}, ${b.secondary_color})`
                          : "var(--gradient-ember)",
                    }}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg">{b.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{b.website_url}</div>
                  </div>
                </div>
                {b.tagline && <p className="mt-4 text-sm text-muted-foreground">{b.tagline}</p>}
                {b.tone && (
                  <div className="mt-4 inline-flex rounded-full border border-border bg-secondary px-2 py-0.5 text-xs">
                    {b.tone}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function ProfileDetail({ id, onClosed }: { id: string; onClosed: () => void }) {
  const getFn = useServerFn(getBusinessProfile);
  const updateFn = useServerFn(updateBusinessProfile);
  const confirmFn = useServerFn(confirmBusinessProfile);
  const importFn = useServerFn(importDiscoveredAsset);
  const brandFn = useServerFn(createBrandFromProfile);
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["business-profile", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [draft, setDraft] = useState<BusinessProfileData>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const row = data ? asProfileRow(data.profile) : null;
  const pages = (data?.pages ?? []) as Array<{ id: string; url: string; page_type: PageType; title: string | null }>;
  const provenance: ProvenanceMap = (row?.provenance_json ?? {}) as ProvenanceMap;
  const assets: DiscoveredAsset[] = (row?.assets_json ?? []) as DiscoveredAsset[];

  useEffect(() => {
    if (row) setDraft({ ...EMPTY_PROFILE, ...row.profile_json });
  }, [row?.id, row]);

  if (isLoading) {
    return <div className="panel mt-6 p-6 text-sm text-muted-foreground">Loading profile…</div>;
  }
  if (error || !row) {
    return (
      <div className="panel mt-6 p-6 text-sm text-destructive">
        We could not open that profile.{" "}
        <button className="underline" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const set = <K extends keyof BusinessProfileData>(key: K, value: BusinessProfileData[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function onSave() {
    setSaving(true);
    try {
      await updateFn({ data: { id, profile: draft as unknown as Record<string, unknown> } });
      toast.success("Saved your corrections");
      qc.invalidateQueries({ queryKey: ["business-profile", id] });
      qc.invalidateQueries({ queryKey: ["business-profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function onConfirm() {
    setSaving(true);
    try {
      await updateFn({ data: { id, profile: draft as unknown as Record<string, unknown> } });
      await confirmFn({ data: { id } });
      toast.success("Profile confirmed — your ads can now treat this as fact");
      qc.invalidateQueries({ queryKey: ["business-profile", id] });
      qc.invalidateQueries({ queryKey: ["business-profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm");
    } finally {
      setSaving(false);
    }
  }

  async function onImport(assetUrl: string) {
    setImporting(assetUrl);
    try {
      await importFn({ data: { profileId: id, url: assetUrl } });
      toast.success("Saved to your private media");
      qc.invalidateQueries({ queryKey: ["business-profile", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import that image");
    } finally {
      setImporting(null);
    }
  }

  async function onBrand() {
    setSaving(true);
    try {
      const res = await brandFn({ data: { id } });
      toast.success(res.created ? `Brand kit created: ${res.name}` : `Brand kit updated: ${res.name}`);
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["business-profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the brand kit");
    } finally {
      setSaving(false);
    }
  }

  const confirmed = row.status === "confirmed";

  const field = (
    key: keyof BusinessProfileData & string,
    label: string,
    multiline = false,
  ) => (
    <div key={key}>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`f-${key}`}>{label}</Label>
        <OriginTag p={provenance[key]} />
      </div>
      {multiline ? (
        <Textarea
          id={`f-${key}`}
          className="mt-2"
          rows={3}
          value={(draft[key] as string) ?? ""}
          onChange={(e) => set(key, e.target.value as never)}
        />
      ) : (
        <Input
          id={`f-${key}`}
          className="mt-2"
          value={(draft[key] as string) ?? ""}
          onChange={(e) => set(key, e.target.value as never)}
        />
      )}
    </div>
  );

  const listField = (key: "offers" | "usps" | "brand_words", label: string) => (
    <div key={key}>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`f-${key}`}>{label}</Label>
        <OriginTag p={provenance[key]} />
        <span className="text-xs text-muted-foreground">one per line</span>
      </div>
      <Textarea
        id={`f-${key}`}
        className="mt-2"
        rows={3}
        value={(draft[key] ?? []).join("\n")}
        onChange={(e) =>
          set(
            key,
            e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    </div>
  );

  return (
    <div className="panel mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl">Review business profile</h3>
          <p className="text-sm text-muted-foreground">
            {row.website_url} · {row.pages_scanned} page(s) read
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confirmed ? (
            <Badge>
              <CheckCircle2 className="mr-1 h-3 w-3" /> Confirmed
            </Badge>
          ) : (
            <Badge variant="secondary">Needs your review</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onClosed}>
            Close
          </Button>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-border bg-secondary px-4 py-3 text-xs text-muted-foreground">
        Items tagged <strong className="text-primary">From your site</strong> were read directly from your
        pages. Items tagged <strong>AI suggestion</strong> are our best guess — please check them before you
        confirm.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {field("business_name", "Business name")}
        {field("business_type", "Type of business")}
        {field("one_liner", "One line summary")}
        {field("cta", "Main call to action")}
        {field("phone", "Phone")}
        {field("email", "Email")}
        {field("target_customer", "Who you serve", true)}
        {field("brand_voice", "Brand voice", true)}
        <div className="md:col-span-2">{field("description", "Description", true)}</div>
        {listField("offers", "Current offers")}
        {listField("usps", "What makes you different")}
      </div>

      {draft.offerings.length > 0 ? (
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-lg">Products & services</h4>
            <OriginTag p={provenance["offerings"]} />
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {draft.offerings.slice(0, 8).map((o, i) => (
              <li key={`${o.name}-${i}`} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{o.name}</span>
                  {o.ai_suggested ? (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      AI suggestion
                    </span>
                  ) : null}
                </div>
                {o.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>
                ) : null}
                {o.price ? <p className="mt-1 text-xs">{o.price}</p> : null}
                {o.source_url ? (
                  <a
                    href={o.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[11px] text-primary underline underline-offset-2"
                  >
                    source page
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {draft.testimonials.length > 0 ? (
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-lg">Reviews we found</h4>
            <OriginTag p={provenance["testimonials"]} />
          </div>
          <ul className="mt-2 space-y-2">
            {draft.testimonials.slice(0, 4).map((t, i) => (
              <li key={i} className="rounded-lg border border-border p-3 text-sm">
                “{t.quote}”
                {t.author ? <span className="text-muted-foreground"> — {t.author}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {assets.length > 0 ? (
        <div className="mt-6">
          <h4 className="font-display text-lg">Logos & images on your site</h4>
          <p className="text-xs text-muted-foreground">
            Pick the ones you want to use in ads. They are saved to your private media.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.slice(0, 12).map((a) => (
              <div key={a.url} className="overflow-hidden rounded-lg border border-border">
                <img
                  src={a.imported_url ?? a.url}
                  alt={a.alt || `${a.kind} from ${row.website_url}`}
                  loading="lazy"
                  className="h-24 w-full bg-secondary object-contain p-2"
                />
                <div className="flex items-center justify-between gap-2 border-t border-border p-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.kind}</span>
                  {a.imported_url ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                      <CheckCircle2 className="h-3 w-3" /> Saved
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onImport(a.url)}
                      disabled={importing !== null}
                    >
                      {importing === a.url ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Use
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pages.length > 0 ? (
        <div className="mt-6">
          <h4 className="font-display text-lg">Pages we read</h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {pages.map((p) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-xs hover:border-primary/40"
                >
                  {PAGE_TYPE_LABELS[p.page_type] ?? p.page_type}
                  <span className="text-muted-foreground">· {new URL(p.url).pathname || "/"}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Separator className="my-6" />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Save corrections
        </Button>
        <Button variant="hero" onClick={onConfirm} disabled={saving}>
          <CheckCircle2 className="h-4 w-4" />
          {confirmed ? "Re-confirm profile" : "Confirm profile"}
        </Button>
        <Button variant="secondary" onClick={onBrand} disabled={saving || !confirmed}>
          {row.brand_id ? "Update brand kit" : "Create brand kit"}
        </Button>
      </div>
      {!confirmed ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Confirm the profile first — only confirmed details are used as facts in your ads.
        </p>
      ) : null}
    </div>
  );
}
