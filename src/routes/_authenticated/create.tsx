import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import {
  AD_TYPES,
  BUSINESS_TYPES,
  DURATIONS,
  EMPTY_BUSINESS,
  FORMATS,
  PLAN_CREDIT_COST,
  TONES,
  TRANSITIONS,
  type AspectRatio,
  type BusinessInfo,
  type TransitionId,
} from "@/lib/ad-types";
import { generateAdPlan, listBrandKits, updateAdPlan } from "@/lib/ads.functions";
import { listCast } from "@/lib/library.functions";
import { uploadAdImage } from "@/lib/uploads";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create an ad — EASY ADs" },
      { name: "description", content: "Answer a few questions about your business and EASY ADs writes, storyboards and renders a ready-to-post video ad." },
      { property: "og:title", content: "Create an ad — EASY ADs" },
      { property: "og:description", content: "Build a downloadable video ad in minutes: script, storyboard, captions and export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateAd,
});

const OBJECTIVES = ["Get more calls", "Drive website visits", "Promote an offer", "Build brand awareness", "Launch a product", "Book appointments"];

const STEPS = ["Business", "Media", "Format & style", "Cast & voice"] as const;

function CreateAd() {
  const navigate = useNavigate();
  const generate = useServerFn(generateAdPlan);
  const savePlan = useServerFn(updateAdPlan);
  const brandsFn = useServerFn(listBrandKits);
  const castFn = useServerFn(listCast);

  const { data: brands = [] } = useQuery({ queryKey: ["brand-kits"], queryFn: () => brandsFn(), retry: false });
  const { data: cast = [] } = useQuery({ queryKey: ["cast"], queryFn: () => castFn(), retry: false });
  const characters = cast.filter((c) => c.kind === "character");
  const voices = cast.filter((c) => c.kind === "voice");

  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<BusinessInfo>(EMPTY_BUSINESS);
  const [brandId, setBrandId] = useState<string>("none");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [sceneImages, setSceneImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [objective, setObjective] = useState(OBJECTIVES[0]!);
  const [adType, setAdType] = useState<string>(AD_TYPES[0]);
  const [tone, setTone] = useState<string>(TONES[0]);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [duration, setDuration] = useState<number>(30);
  const [primary, setPrimary] = useState("#f59e0b");
  const [secondary, setSecondary] = useState("#111827");
  const [captions, setCaptions] = useState(true);
  const [transition, setTransition] = useState<TransitionId>("fade");
  const [characterId, setCharacterId] = useState("none");
  const [voiceId, setVoiceId] = useState("none");

  const set = (k: keyof BusinessInfo) => (v: string) => setBusiness((b) => ({ ...b, [k]: v }));

  async function handleUpload(files: FileList | null, kind: "logo" | "scene") {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const url = await uploadAdImage(file, kind === "logo" ? "logos" : "scenes");
        if (kind === "logo") setLogoUrl(url);
        else setSceneImages((s) => [...s, url]);
      }
      toast.success("Upload complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await generate({
        data: {
          business: { ...business, cta: business.cta || "Call today" },
          style: { ad_type: adType, tone, aspect, duration },
          ...(brandId !== "none" ? { brandId } : {}),
        },
      });
      // Apply wizard-level creative choices to the generated plan.
      const plan = {
        ...res.plan,
        palette: { primary, secondary },
        captions_enabled: captions,
        transition,
        objective,
        audience: business.target_customer,
        ...(logoUrl ? { logo_url: logoUrl } : {}),
        ...(characterId !== "none" ? { character_id: characterId } : {}),
        ...(voiceId !== "none" ? { voice_id: voiceId } : {}),
        scenes: res.plan.scenes.map((s, i) =>
          sceneImages[i] ? { ...s, image_url: sceneImages[i]! } : s,
        ),
      };
      await savePlan({ data: { projectId: res.projectId, plan } });
      return res.projectId;
    },
    onSuccess: (projectId) => {
      toast.success("Script and storyboard ready");
      navigate({ to: "/ads/$adId", params: { adId: projectId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate the ad"),
  });

  const canContinue = step !== 0 || business.business_name.trim().length > 1;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl">Create an ad</h1>
        <p className="mt-1 text-muted-foreground">
          Four quick steps. Generating the script and storyboard costs {PLAN_CREDIT_COST} credits.
        </p>

        <ol className="mt-6 flex flex-wrap gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`rounded-full border px-3 py-1 ${
                i === step ? "border-primary text-primary" : i < step ? "border-border text-foreground" : "border-border/50 text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="panel mt-6 space-y-5 p-6">
          {step === 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name *">
                  <Input value={business.business_name} onChange={(e) => set("business_name")(e.target.value)} placeholder="Wayne's Landscaping" />
                </Field>
                <Field label="Business type">
                  <Select value={business.business_type || undefined} onValueChange={set("business_type")}>
                    <SelectTrigger><SelectValue placeholder="Choose a type" /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="What does the business do?">
                <Textarea rows={3} value={business.description} onChange={(e) => set("description")(e.target.value)} placeholder="Full-service lawn care and garden design for homeowners." />
              </Field>
              <Field label="Products or services to feature">
                <Textarea rows={2} value={business.products} onChange={(e) => set("products")(e.target.value)} placeholder="Weekly mowing, hedge trimming, seasonal cleanups" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Target customer / audience">
                  <Input value={business.target_customer} onChange={(e) => set("target_customer")(e.target.value)} placeholder="Homeowners aged 30-60" />
                </Field>
                <Field label="Location">
                  <Input value={business.location} onChange={(e) => set("location")(e.target.value)} placeholder="Austin, TX" />
                </Field>
                <Field label="Phone">
                  <Input value={business.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="(555) 123-4567" />
                </Field>
                <Field label="Website URL (optional)">
                  <Input value={business.website} onChange={(e) => set("website")(e.target.value)} placeholder="https://example.com" />
                </Field>
                <Field label="Special offer (optional)">
                  <Input value={business.offer} onChange={(e) => set("offer")(e.target.value)} placeholder="20% off first cleanup" />
                </Field>
                <Field label="Call to action">
                  <Input value={business.cta} onChange={(e) => set("cta")(e.target.value)} placeholder="Call today for a free quote" />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Logo (optional)" hint="Shown in the corner of every scene.">
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" /> Upload logo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files, "logo")} />
                  </label>
                  {logoUrl && (
                    <div className="flex items-center gap-2">
                      <img src={logoUrl} alt="Uploaded logo" className="h-10 w-10 rounded border border-border object-contain" />
                      <Button type="button" size="sm" variant="ghost" onClick={() => setLogoUrl("")}><X className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              </Field>

              <Field label="Product / job photos (optional)" hint="Used as scene backgrounds in order. Scenes without a photo use animated graphics.">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" /> Add images
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files, "scene")} />
                </label>
              </Field>

              {uploading && <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Uploading…</p>}

              {sceneImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {sceneImages.map((url, i) => (
                    <div key={url} className="relative overflow-hidden rounded-lg border border-border">
                      <img src={url} alt={`Scene image ${i + 1}`} className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() => setSceneImages((s) => s.filter((u) => u !== url))}
                        className="absolute right-1 top-1 rounded bg-background/80 p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Field label="Brand kit (optional)" hint="Applies saved colors, logo, font and contact details.">
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No brand kit</SelectItem>
                    {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Objective">
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Ad type">
                  <Select value={adType} onValueChange={setAdType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Tone">
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Duration">
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} seconds</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Format / platform">
                <div className="grid gap-3 sm:grid-cols-3">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAspect(f.id)}
                      className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                        aspect === f.id ? "border-primary bg-secondary" : "border-border hover:bg-accent"
                      }`}
                    >
                      <div className="font-medium">{f.label} · {f.id}</div>
                      <div className="text-xs text-muted-foreground">{f.hint}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Primary color">
                  <div className="flex items-center gap-2">
                    <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" aria-label="Primary color" />
                    <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
                  </div>
                </Field>
                <Field label="Secondary color">
                  <div className="flex items-center gap-2">
                    <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" aria-label="Secondary color" />
                    <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} />
                  </div>
                </Field>
                <Field label="Scene transition">
                  <Select value={transition} onValueChange={(v) => setTransition(v as TransitionId)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRANSITIONS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <div className="flex items-end gap-3 pb-2">
                  <Switch id="captions" checked={captions} onCheckedChange={setCaptions} />
                  <Label htmlFor="captions">Burn in captions</Label>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Character" hint="Saved from your cast library. Guides how people are described in the script.">
                <Select value={characterId} onValueChange={setCharacterId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific character</SelectItem>
                    {characters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Voice" hint="Stored with the ad and used for the voiceover script. Spoken audio needs a voice provider key (not connected).">
                <Select value={voiceId} onValueChange={setVoiceId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No voice selected</SelectItem>
                    {voices.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {characters.length === 0 && voices.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Your cast library is empty — you can add characters and voices later from the Cast page. This step is optional.
                </p>
              )}
              <div className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
                Exports are downloadable video files. EASY ADs never posts to your social accounts.
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
          {step < STEPS.length - 1 ? (
            <Button
              variant="hero"
              disabled={!canContinue}
              onClick={() => (canContinue ? setStep((s) => s + 1) : toast.error("Add a business name first"))}
            >
              Continue
            </Button>
          ) : (
            <Button variant="hero" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {mutation.isPending ? "Writing your ad…" : `Generate ad (${PLAN_CREDIT_COST} credits)`}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
