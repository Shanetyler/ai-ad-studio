import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ImagePlus, Loader2, Pencil, Plus, Star, Trash2, UserRound, X } from "lucide-react";
import {
  deleteCast,
  getCastCapabilities,
  getCastReferenceUrls,
  listCast,
  saveCast,
  updateCastReferences,
} from "@/lib/library.functions";
import { uploadCharacterReference, validateReferenceFile } from "@/lib/uploads";
import {
  EMPTY_APPEARANCE,
  EMPTY_VOICE,
  buildAppearancePrompt,
  type CharacterAppearance,
  type CharacterReferenceImage,
  type CharacterVoice,
} from "@/lib/character";


export const Route = createFileRoute("/_authenticated/cast")({
  head: () => ({
    meta: [
      { title: "Character Studio — EASY ADs" },
      {
        name: "description",
        content:
          "Build reusable on-camera characters and voice profiles with reference images, appearance guidance, and rights confirmation.",
      },
      { property: "og:title", content: "Character Studio — EASY ADs" },
      { property: "og:description", content: "Reusable characters and voice direction for every ad you make." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CharacterStudio,
});

/* eslint-disable @typescript-eslint/no-explicit-any */

type Draft = {
  id?: string;
  kind: "character" | "voice";
  name: string;
  description: string;
  reference_images: CharacterReferenceImage[];
  primary_reference_path: string | null;
  reference_url: string;
  appearance: CharacterAppearance;
  appearance_prompt: string;
  voice: CharacterVoice;
  voice_provider: string;
  voice_provider_ref: string;
  seed: string;
  rights_confirmed: boolean;
  consent_by: string;
  consent_scope: string;
};

const emptyDraft = (kind: "character" | "voice"): Draft => ({
  kind,
  name: "",
  description: "",
  reference_images: [],
  primary_reference_path: null,
  reference_url: "",
  appearance: { ...EMPTY_APPEARANCE },
  appearance_prompt: "",
  voice: { ...EMPTY_VOICE },
  voice_provider: "",
  voice_provider_ref: "",
  seed: "",
  rights_confirmed: false,
  consent_by: "",
  consent_scope: "",
});

function fromRow(row: any): Draft {
  return {
    id: row.id,
    kind: row.kind === "voice" ? "voice" : "character",
    name: row.name ?? "",
    description: row.description ?? "",
    reference_images: (row.reference_images ?? []) as CharacterReferenceImage[],
    primary_reference_path: row.primary_reference_path ?? null,
    reference_url: row.reference_url ?? "",
    appearance: { ...EMPTY_APPEARANCE, ...((row.appearance_json ?? {}) as Partial<CharacterAppearance>) },
    appearance_prompt: row.appearance_prompt ?? "",
    voice: { ...EMPTY_VOICE, ...((row.voice_json ?? {}) as Partial<CharacterVoice>) },
    voice_provider: row.voice_provider ?? "",
    voice_provider_ref: row.voice_provider_ref ?? "",
    seed: row.generation_seed != null ? String(row.generation_seed) : "",
    rights_confirmed: Boolean(row.rights_confirmed),
    consent_by: row.consent_by ?? "",
    consent_scope: row.consent_scope ?? "",
  };
}

function CharacterStudio() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCast);
  const saveFn = useServerFn(saveCast);
  const delFn = useServerFn(deleteCast);
  const delRefFn = useServerFn(deleteCastReference);
  const signFn = useServerFn(getCastReferenceUrls);
  const capsFn = useServerFn(getCastCapabilities);

  const [draft, setDraft] = useState<Draft>(emptyDraft("character"));
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const { data: cast, isLoading, isError, error } = useQuery({
    queryKey: ["cast"],
    queryFn: () => listFn(),
    retry: false,
  });
  const { data: caps } = useQuery({ queryKey: ["cast-caps"], queryFn: () => capsFn(), retry: false });

  const allPaths = useMemo(() => {
    const paths = new Set<string>();
    (cast ?? []).forEach((c: any) => (c.reference_images ?? []).forEach((r: any) => r?.path && paths.add(r.path)));
    draft.reference_images.forEach((r) => paths.add(r.path));
    return Array.from(paths);
  }, [cast, draft.reference_images]);

  const [signed, setSigned] = useState<Record<string, string>>({});
  useEffect(() => {
    const missing = allPaths.filter((p) => !signed[p]);
    if (!missing.length) return;
    signFn({ data: { paths: missing } })
      .then((urls) => setSigned((s) => ({ ...s, ...urls })))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPaths.join("|")]);

  const previewPrompt = useMemo(
    () => draft.appearance_prompt || buildAppearancePrompt(draft.name, draft.description, draft.appearance),
    [draft.appearance_prompt, draft.name, draft.description, draft.appearance],
  );

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          kind: draft.kind,
          name: draft.name.trim(),
          description: draft.description.trim(),
          attributes: {},
          ...(draft.reference_url.trim() ? { reference_url: draft.reference_url.trim() } : {}),
          rights_confirmed: draft.rights_confirmed,
          reference_images: draft.reference_images,
          primary_reference_path: draft.primary_reference_path,
          appearance_json: draft.appearance,
          appearance_prompt: previewPrompt,
          voice_json: draft.voice,
          voice_provider: draft.voice_provider.trim() || null,
          voice_provider_ref: draft.voice_provider_ref.trim() || null,
          generation_json: draft.seed ? { seed: Number(draft.seed) } : {},
          generation_seed: draft.seed ? Number(draft.seed) : null,
          consent_by: draft.consent_by.trim() || null,
          consent_scope: draft.consent_scope.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(draft.id ? "Character updated" : draft.kind === "character" ? "Character saved" : "Voice saved");
      setDraft(emptyDraft(draft.kind));
      queryClient.invalidateQueries({ queryKey: ["cast"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: (_r, id) => {
      toast.success("Removed");
      if (draft.id === id) setDraft(emptyDraft(draft.kind));
      queryClient.invalidateQueries({ queryKey: ["cast"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    if (draft.reference_images.length + files.length > 8) {
      toast.error("Up to 8 reference images per character.");
      return;
    }
    setUploading(true);
    try {
      const added: CharacterReferenceImage[] = [];
      for (const file of Array.from(files)) {
        const path = await uploadCharacterReference(file, draft.id ?? "draft");
        added.push({ path, label: file.name.slice(0, 60) });
      }
      setDraft((d) => {
        const refs = [...d.reference_images, ...added];
        return { ...d, reference_images: refs, primary_reference_path: d.primary_reference_path ?? refs[0]?.path ?? null };
      });
      toast.success(added.length === 1 ? "Reference added" : `${added.length} references added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeRef(path: string) {
    setDraft((d) => {
      const refs = d.reference_images.filter((r) => r.path !== path);
      return {
        ...d,
        reference_images: refs,
        primary_reference_path: d.primary_reference_path === path ? refs[0]?.path ?? null : d.primary_reference_path,
      };
    });
    try {
      await delRefFn({ data: { path } });
    } catch {
      /* file may already be gone; the record no longer points at it */
    }
  }

  const isCharacter = draft.kind === "character";
  const canSave = draft.name.trim().length >= 2 && draft.rights_confirmed && !save.isPending && !uploading;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Character Studio</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Build a character once and reuse it across every ad. Reference images, appearance guidance and voice direction
            steer generation for a consistent look — they are guidance, not a face or voice clone.
          </p>
        </div>
        {draft.id && (
          <Button variant="outline" onClick={() => setDraft(emptyDraft(draft.kind))}>
            <Plus className="h-4 w-4" /> New character
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ------------------------------- editor ------------------------------- */}
        <div className="panel space-y-5 p-5">
          <Tabs
            value={draft.kind}
            onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as "character" | "voice" }))}
          >
            <TabsList className="w-full">
              <TabsTrigger value="character" className="flex-1">Reusable character</TabsTrigger>
              <TabsTrigger value="voice" className="flex-1">Voice profile</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground">
            {isCharacter
              ? "A reusable character carries reference images, appearance details and a locked seed so the same person shows up in future ads."
              : "A voice profile is a one-off delivery style: tone, pace and accent notes used when narration is generated."}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Name</Label>
            <Input
              id="ch-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={isCharacter ? "Shane, friendly crew lead" : "Warm female narrator"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Description</Label>
            <Textarea
              id="ch-desc"
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={
                isCharacter
                  ? "Man in his 40s, navy work shirt, confident and approachable, always on a suburban lawn."
                  : "Warm mid-range female voice, conversational pace, upbeat but trustworthy."
              }
            />
          </div>

          {isCharacter && (
            <>
              {/* reference images */}
              <section className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-medium">Reference images</h2>
                    <p className="text-xs text-muted-foreground">
                      Stored privately. Pick one primary frame — it is the one sent to generation.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    Add
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => onFiles(e.target.files)}
                  />
                </div>

                {draft.reference_images.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No references yet. PNG, JPG or WEBP up to 8 MB each, 8 images max.
                  </p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {draft.reference_images.map((r) => {
                      const primary = draft.primary_reference_path === r.path;
                      return (
                        <li
                          key={r.path}
                          className={`group relative overflow-hidden rounded-lg border ${primary ? "border-primary ring-2 ring-primary/30" : "border-border/60"}`}
                        >
                          {signed[r.path] ? (
                            <img src={signed[r.path]} alt={r.label || "Character reference"} className="aspect-square w-full object-cover" />
                          ) : (
                            <Skeleton className="aspect-square w-full" />
                          )}
                          <button
                            type="button"
                            aria-label={primary ? "Primary reference" : "Set as primary reference"}
                            onClick={() => set("primary_reference_path", r.path)}
                            className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-background/85"
                          >
                            <Star className={`h-3.5 w-3.5 ${primary ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove reference"
                            onClick={() => removeRef(r.path)}
                            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-background/85"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="ch-refurl" className="text-xs">Reference link (optional)</Label>
                  <Input
                    id="ch-refurl"
                    value={draft.reference_url}
                    onChange={(e) => set("reference_url", e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </section>

              {/* appearance */}
              <section className="space-y-3 rounded-xl border border-border/60 p-3">
                <div>
                  <h2 className="text-sm font-medium">Appearance</h2>
                  <p className="text-xs text-muted-foreground">
                    These details are written into every prompt for this character so the look stays consistent.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AppField id="age" label="Age range" value={draft.appearance.age_range} placeholder="40s"
                    onChange={(v) => set("appearance", { ...draft.appearance, age_range: v })} />
                  <AppField id="gender" label="Presentation" value={draft.appearance.gender_presentation} placeholder="Male"
                    onChange={(v) => set("appearance", { ...draft.appearance, gender_presentation: v })} />
                  <AppField id="eth" label="Ethnicity / look" value={draft.appearance.ethnicity} placeholder="Caucasian"
                    onChange={(v) => set("appearance", { ...draft.appearance, ethnicity: v })} />
                  <AppField id="hair" label="Hair" value={draft.appearance.hair} placeholder="Short dark brown"
                    onChange={(v) => set("appearance", { ...draft.appearance, hair: v })} />
                  <AppField id="fhair" label="Facial hair" value={draft.appearance.facial_hair} placeholder="Light stubble"
                    onChange={(v) => set("appearance", { ...draft.appearance, facial_hair: v })} />
                  <AppField id="ward" label="Wardrobe" value={draft.appearance.wardrobe} placeholder="Navy work shirt"
                    onChange={(v) => set("appearance", { ...draft.appearance, wardrobe: v })} />
                  <AppField id="dist" label="Distinguishing" value={draft.appearance.distinguishing} placeholder="Warm, easy smile"
                    onChange={(v) => set("appearance", { ...draft.appearance, distinguishing: v })} />
                  <AppField id="setting" label="Usual setting" value={draft.appearance.setting} placeholder="Suburban front lawn"
                    onChange={(v) => set("appearance", { ...draft.appearance, setting: v })} />
                  <AppField id="framing" label="Framing" value={draft.appearance.framing} placeholder="Medium close-up"
                    onChange={(v) => set("appearance", { ...draft.appearance, framing: v })} />
                  <AppField id="seed" label="Locked seed (optional)" value={draft.seed} placeholder="123456"
                    onChange={(v) => set("seed", v.replace(/[^0-9]/g, "").slice(0, 9))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ch-prompt" className="text-xs">Reusable appearance prompt</Label>
                  <Textarea
                    id="ch-prompt"
                    rows={3}
                    value={draft.appearance_prompt}
                    onChange={(e) => set("appearance_prompt", e.target.value)}
                    placeholder={previewPrompt}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the auto-written version: “{previewPrompt.slice(0, 120)}…”
                  </p>
                </div>
              </section>
            </>
          )}

          {/* voice */}
          <section className="space-y-3 rounded-xl border border-border/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium">Voice</h2>
                <p className="text-xs text-muted-foreground">Direction for narration. No voice cloning is performed.</p>
              </div>
              <Badge variant={caps?.voice.configured ? "secondary" : "outline"}>
                {caps?.voice.configured ? "Narration available" : "Narration not configured"}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AppField id="v-style" label="Style" value={draft.voice.style} placeholder="Warm, confident"
                onChange={(v) => set("voice", { ...draft.voice, style: v })} />
              <AppField id="v-pace" label="Pace" value={draft.voice.pace} placeholder="Conversational"
                onChange={(v) => set("voice", { ...draft.voice, pace: v })} />
              <AppField id="v-accent" label="Accent" value={draft.voice.accent} placeholder="Neutral US"
                onChange={(v) => set("voice", { ...draft.voice, accent: v })} />
              <AppField id="v-dir" label="Delivery notes" value={draft.voice.direction} placeholder="Smile through the CTA"
                onChange={(v) => set("voice", { ...draft.voice, direction: v })} />
            </div>
            {caps?.voice.configured ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <AppField id="v-prov" label="Voice provider" value={draft.voice_provider} placeholder={caps.voice.id ?? "elevenlabs"}
                  onChange={(v) => set("voice_provider", v)} />
                <AppField id="v-ref" label="Provider voice ID" value={draft.voice_provider_ref} placeholder="21m00Tcm4TlvDq8ikWAM"
                  onChange={(v) => set("voice_provider_ref", v)} />
              </div>
            ) : (
              <p className="rounded-lg bg-secondary/60 p-2 text-xs text-muted-foreground">
                No narration provider is connected yet, so provider voice IDs are hidden. Ads render with captions and a
                music bed until one is configured.
              </p>
            )}
          </section>

          {/* rights & consent */}
          <section className="space-y-3 rounded-xl border border-border/60 p-3">
            <h2 className="text-sm font-medium">Rights &amp; consent</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <AppField id="c-by" label="Confirmed by" value={draft.consent_by} placeholder="Your name"
                onChange={(v) => set("consent_by", v)} />
              <AppField id="c-scope" label="Permitted use" value={draft.consent_scope} placeholder="Paid social ads, 12 months"
                onChange={(v) => set("consent_scope", v)} />
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-sm">
              <Checkbox
                checked={draft.rights_confirmed}
                onCheckedChange={(v) => set("rights_confirmed", v === true)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                I own or have written permission to use this likeness and/or voice in advertising. References are only used
                for generation once this is confirmed.
              </span>
            </label>
          </section>

          <Button className="w-full" variant="hero" disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {draft.id ? "Save changes" : isCharacter ? "Save character" : "Save voice"}
          </Button>
        </div>

        {/* -------------------------------- list -------------------------------- */}
        <div className="space-y-4">
          {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}

          {isError && (
            <div className="panel p-5">
              <p className="font-medium">We couldn’t load your characters</p>
              <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
            </div>
          )}

          {cast && cast.length === 0 && (
            <div className="panel grid place-items-center p-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary">
                <UserRound className="h-5 w-5 text-primary" />
              </div>
              <h2 className="mt-4 font-display text-2xl">No characters yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Build one on the left. Saved characters become selectable when you create an ad.
              </p>
            </div>
          )}

          {cast?.map((member: any) => {
            const refs = (member.reference_images ?? []) as CharacterReferenceImage[];
            const primaryPath = member.primary_reference_path ?? refs.find((r) => r.primary)?.path ?? refs[0]?.path;
            const thumb = primaryPath ? signed[primaryPath] : member.reference_url || undefined;
            return (
              <article key={member.id} className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-secondary">
                  {thumb ? (
                    <img src={thumb} alt={`${member.name} reference`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <UserRound className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg">{member.name}</h3>
                    <Badge variant="secondary">{member.kind === "voice" ? "Voice profile" : "Reusable character"}</Badge>
                    {member.rights_confirmed ? (
                      <Badge variant="outline">Rights confirmed</Badge>
                    ) : (
                      <Badge variant="destructive">Rights needed</Badge>
                    )}
                    {refs.length > 0 && <Badge variant="outline">{refs.length} reference{refs.length > 1 ? "s" : ""}</Badge>}
                    {member.generation_seed != null && <Badge variant="outline">Seed {member.generation_seed}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{member.description || "No description"}</p>
                  {member.appearance_prompt && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground/80">{member.appearance_prompt}</p>
                  )}
                  {member.consent_by && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Confirmed by {member.consent_by}
                      {member.consent_scope ? ` — ${member.consent_scope}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 sm:flex-col">
                  <Button size="sm" variant="outline" onClick={() => setDraft(fromRow(member))}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${member.name}`} onClick={() => remove.mutate(member.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function AppField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
