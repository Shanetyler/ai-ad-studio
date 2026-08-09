import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { AdPreview } from "@/components/ad-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import {
  RENDER_CREDIT_COST,
  TRANSITIONS,
  type AdPlan,
  type AdScene,
  type AspectRatio,
  type TransitionId,
} from "@/lib/ad-types";
import { MEDIA_LIBRARY } from "@/lib/media-library";
import {
  completeAdRender,
  failAdRender,
  getAd,
  getAdVideoUrl,
  startAdRender,
  updateAdPlan,
} from "@/lib/ads.functions";
import { renderAdToBlob } from "@/lib/render/ad-renderer";
import { uploadAdImage, uploadAdVideo } from "@/lib/uploads";
import { VideoPlayer } from "@/components/video-player";

export const Route = createFileRoute("/_authenticated/ads/$adId")({
  head: () => ({
    meta: [
      { title: "Edit ad — EASY ADs" },
      { name: "description", content: "Edit scenes, captions, durations and transitions, then export a downloadable video ad." },
      { property: "og:title", content: "Edit ad — EASY ADs" },
      { property: "og:description", content: "Storyboard editor with live preview and browser video export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <AppShell>
      <div className="panel p-6">
        <h1 className="font-display text-2xl">We couldn’t open this ad</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-4" asChild><Link to="/ads">Back to my ads</Link></Button>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="panel p-6">
        <h1 className="font-display text-2xl">Ad not found</h1>
        <Button className="mt-4" asChild><Link to="/ads">Back to my ads</Link></Button>
      </div>
    </AppShell>
  ),
  component: AdEditor,
});

type RenderPhase = "idle" | "reserving" | "rendering" | "uploading" | "done" | "error";

function AdEditor() {
  const { adId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getAdFn = useServerFn(getAd);
  const saveFn = useServerFn(updateAdPlan);
  const startFn = useServerFn(startAdRender);
  const completeFn = useServerFn(completeAdRender);
  const failFn = useServerFn(failAdRender);
  const videoUrlFn = useServerFn(getAdVideoUrl);

  const { data: ad, isLoading, isError, error } = useQuery({
    queryKey: ["ad", adId],
    queryFn: () => getAdFn({ data: { projectId: adId } }),
    retry: false,
  });

  const [plan, setPlan] = useState<AdPlan | null>(null);
  const [title, setTitle] = useState("");
  const [dirty, setDirty] = useState(false);
  const [phase, setPhase] = useState<RenderPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [localVideo, setLocalVideo] = useState<{ url: string; ext: string } | null>(null);
  const localVideoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ad) return;
    setPlan((ad.plan_json as unknown as AdPlan) ?? null);
    setTitle(ad.title ?? "");
    setDirty(false);
  }, [ad]);

  useEffect(() => () => { if (localVideoRef.current) URL.revokeObjectURL(localVideoRef.current); }, []);

  const aspect = ((ad?.aspect_ratio as AspectRatio) ?? "9:16") as AspectRatio;

  const { data: savedVideo } = useQuery({
    queryKey: ["ad-video", adId, ad?.supabase_video_path],
    queryFn: () => videoUrlFn({ data: { projectId: adId } }),
    enabled: !!ad?.supabase_video_path,
    retry: false,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!plan) return;
      await saveFn({ data: { projectId: adId, plan, title: title.slice(0, 120) || "Untitled ad" } });
    },
    onSuccess: () => {
      setDirty(false);
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: ["ad", adId] });
      queryClient.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  function mutate(fn: (p: AdPlan) => AdPlan) {
    setPlan((p) => (p ? fn(p) : p));
    setDirty(true);
  }

  function updateScene(id: string, patch: Partial<AdScene>) {
    mutate((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }

  function moveScene(index: number, dir: -1 | 1) {
    mutate((p) => {
      const scenes = [...p.scenes];
      const target = index + dir;
      if (target < 0 || target >= scenes.length) return p;
      [scenes[index], scenes[target]] = [scenes[target]!, scenes[index]!];
      return { ...p, scenes };
    });
  }

  function addScene() {
    mutate((p) => ({
      ...p,
      scenes: [
        ...p.scenes,
        {
          id: crypto.randomUUID(),
          duration_s: 4,
          title: `Scene ${p.scenes.length + 1}`,
          description: "",
          caption: "",
          asset_id: MEDIA_LIBRARY[0]?.id,
        },
      ],
    }));
  }

  function removeScene(id: string) {
    mutate((p) => (p.scenes.length <= 2 ? p : { ...p, scenes: p.scenes.filter((s) => s.id !== id) }));
  }

  async function uploadSceneImage(id: string, files: FileList | null) {
    if (!files?.[0]) return;
    try {
      const url = await uploadAdImage(files[0], "scenes");
      updateScene(id, { image_url: url, asset_id: "upload" });
      toast.success("Image added to scene");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  const totalDuration = useMemo(
    () => (plan ? plan.scenes.reduce((sum, s) => sum + (s.duration_s || 0), 0) : 0),
    [plan],
  );

  async function exportVideo() {
    if (!plan) return;
    setRenderError(null);
    setProgress(0);
    let reservation: { jobId: string } | null = null;
    try {
      if (dirty) await saveFn({ data: { projectId: adId, plan, title: title || "Untitled ad" } });
      setPhase("reserving");
      reservation = await startFn({ data: { projectId: adId } });
      setPhase("rendering");
      const result = await renderAdToBlob({
        plan,
        aspect,
        onProgress: (pct) => setProgress(pct),
      });
      setPhase("uploading");
      const path = await uploadAdVideo(adId, result.blob, result.ext);
      await completeFn({
        data: { projectId: adId, jobId: reservation.jobId, path, mime: result.mime, duration: result.duration },
      });
      if (localVideoRef.current) URL.revokeObjectURL(localVideoRef.current);
      const url = URL.createObjectURL(result.blob);
      localVideoRef.current = url;
      setLocalVideo({ url, ext: result.ext });
      setPhase("done");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["ad", adId] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      toast.success(`Export complete (.${result.ext})`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      setRenderError(message);
      setPhase("error");
      if (reservation) {
        await failFn({ data: { projectId: adId, jobId: reservation.jobId, message } }).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: ["credits"] });
        toast.error(`${message} — your ${RENDER_CREDIT_COST} render credits were refunded.`);
      } else {
        toast.error(message);
      }
    }
  }

  function download() {
    const url = localVideo?.url ?? savedVideo?.url;
    if (!url) return;
    const ext = localVideo?.ext ?? (ad?.video_mime?.includes("mp4") ? "mp4" : "webm");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "easy-ad").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-[420px] w-full rounded-2xl" />
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (isError || !ad || !plan) {
    return (
      <AppShell>
        <div className="panel p-6">
          <h1 className="font-display text-2xl">This ad has no storyboard yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isError ? (error as Error).message : "Generate a script to build the storyboard."}
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: "/create" })}>Start a new ad</Button>
        </div>
      </AppShell>
    );
  }

  const busy = phase === "reserving" || phase === "rendering" || phase === "uploading";
  const videoUrl = localVideo?.url ?? savedVideo?.url ?? null;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            className="h-auto border-none bg-transparent px-0 font-display text-3xl focus-visible:ring-0"
            aria-label="Ad title"
          />
          <p className="text-sm text-muted-foreground">
            {plan.scenes.length} scenes · {totalDuration.toFixed(0)}s · {aspect}
            {ad.video_status === "ready" ? " · exported" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
          <Button variant="hero" onClick={exportVideo} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Video />}
            {busy ? "Exporting…" : `Export video (${RENDER_CREDIT_COST} credits)`}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <div className="panel p-4">
            <AdPreview plan={plan} aspect={aspect} />
            {busy && (
              <div className="mt-4 space-y-2">
                <Progress value={phase === "rendering" ? progress : phase === "uploading" ? 100 : 5} />
                <p className="text-xs text-muted-foreground">
                  {phase === "reserving" && "Reserving credits…"}
                  {phase === "rendering" && `Recording your ad in the browser — ${progress}%. Keep this tab visible.`}
                  {phase === "uploading" && "Saving the file to your library…"}
                </p>
              </div>
            )}
            {phase === "error" && renderError && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium">Export failed</p>
                <p className="mt-1 text-muted-foreground">{renderError}</p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={exportVideo}>Retry export</Button>
              </div>
            )}
            {videoUrl && (
              <div className="mt-5 space-y-3">
                <VideoPlayer src={videoUrl} />
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={download}><Download /> Download video</Button>
                  <p className="text-xs text-muted-foreground">
                    Exported as .{localVideo?.ext ?? (ad.video_mime?.includes("mp4") ? "mp4" : "webm")} using your browser’s
                    native recorder. Upload it yourself to Meta, TikTok or Google Ads — EASY ADs never posts for you.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Storyboard</h2>
              <Button size="sm" variant="secondary" onClick={addScene}><Plus /> Add scene</Button>
            </div>
            {plan.scenes.map((scene, i) => (
              <div key={scene.id} className="panel space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Scene {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" aria-label="Move scene up" onClick={() => moveScene(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Move scene down" onClick={() => moveScene(i, 1)} disabled={i === plan.scenes.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Delete scene" onClick={() => removeScene(scene.id)} disabled={plan.scenes.length <= 2}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Scene title</Label>
                    <Input value={scene.title} onChange={(e) => updateScene(scene.id, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration: {scene.duration_s}s</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={scene.duration_s}
                      onChange={(e) => updateScene(scene.id, { duration_s: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>On-screen caption</Label>
                  <Input value={scene.caption} onChange={(e) => updateScene(scene.id, { caption: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Visual direction</Label>
                  <Textarea rows={2} value={scene.description} onChange={(e) => updateScene(scene.id, { description: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Animated background</Label>
                    <Select
                      value={scene.asset_id ?? MEDIA_LIBRARY[0]!.id}
                      onValueChange={(v) => updateScene(scene.id, { asset_id: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MEDIA_LIBRARY.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Photo (overrides background)</Label>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                        <Upload className="h-4 w-4" /> Upload
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadSceneImage(scene.id, e.target.files)} />
                      </label>
                      {scene.image_url && (
                        <>
                          <img src={scene.image_url} alt="" className="h-9 w-12 rounded border border-border object-cover" />
                          <Button size="sm" variant="ghost" onClick={() => updateScene(scene.id, { image_url: undefined })}>Remove</Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel space-y-4 p-4">
            <h2 className="font-display text-xl">Creative controls</h2>
            <div className="space-y-1.5">
              <Label>Hook headline</Label>
              <Textarea rows={2} value={plan.hook} onChange={(e) => mutate((p) => ({ ...p, hook: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Call to action</Label>
              <Input value={plan.cta} onChange={(e) => mutate((p) => ({ ...p, cta: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact line</Label>
              <Input value={plan.contact_line ?? ""} onChange={(e) => mutate((p) => ({ ...p, contact_line: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Voiceover script</Label>
              <Textarea rows={5} value={plan.voiceover} onChange={(e) => mutate((p) => ({ ...p, voiceover: e.target.value }))} />
              <p className="text-xs text-muted-foreground">
                Exports include a generated music bed. Spoken voiceover requires a voice provider key, which isn’t connected.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Primary color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Primary color"
                    value={plan.palette.primary}
                    onChange={(e) => mutate((p) => ({ ...p, palette: { ...p.palette, primary: e.target.value } }))}
                    className="h-9 w-12 rounded border border-border bg-transparent"
                  />
                  <Input value={plan.palette.primary} onChange={(e) => mutate((p) => ({ ...p, palette: { ...p.palette, primary: e.target.value } }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Font</Label>
                <Select value={plan.font} onValueChange={(v) => mutate((p) => ({ ...p, font: v as AdPlan["font"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="display">Display</SelectItem>
                    <SelectItem value="sans">Sans</SelectItem>
                    <SelectItem value="mono">Mono</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Transition</Label>
              <Select
                value={plan.transition ?? "fade"}
                onValueChange={(v) => mutate((p) => ({ ...p, transition: v as TransitionId }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRANSITIONS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="cap"
                checked={plan.captions_enabled}
                onCheckedChange={(v) => mutate((p) => ({ ...p, captions_enabled: v }))}
              />
              <Label htmlFor="cap">Burn in captions</Label>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
