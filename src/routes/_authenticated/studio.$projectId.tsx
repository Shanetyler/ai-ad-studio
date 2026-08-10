import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { getProject, generateSceneVisuals } from "@/lib/studio.functions";
import { startVideoRender, getVideoUrl } from "@/lib/video.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Film, Wand2, Clapperboard, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/studio/$projectId")({
  component: ProjectView,
});

type Scene = {
  index: number;
  duration_s: number;
  shot: string;
  visual: string;
  voiceover: string;
  on_screen_text?: string;
  image_url?: string;
};

const STATUS_LABEL: Record<string, string> = {
  idle: "Ready to render",
  generating: "Generating video…",
  uploading: "Uploading to Mux…",
  processing: "Mux processing…",
  ready: "Ready",
  error: "Error",
};

function ProjectView() {
  const { projectId } = Route.useParams();
  const fn = useServerFn(getProject);
  const visualsFn = useServerFn(generateSceneVisuals);
  const renderFn = useServerFn(startVideoRender);
  const videoUrlFn = useServerFn(getVideoUrl);
  const qc = useQueryClient();
  const [visualsLoading, setVisualsLoading] = useState(false);
  const [renderLoading, setRenderLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fn({ data: { id: projectId } }),
  });

  // Realtime: refetch on any change to this project row
  useEffect(() => {
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, qc]);

  async function onGenerateVisuals() {
    setVisualsLoading(true);
    try {
      await visualsFn({ data: { projectId } });
      toast.success("Scene visuals rendered");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["credits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setVisualsLoading(false);
    }
  }

  async function onGenerateVideo() {
    setRenderLoading(true);
    try {
      await renderFn({ data: { projectId } });
      toast.success("Video render started");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["credits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setRenderLoading(false);
    }
  }

  const projectMeta = data?.project as
    | { video_status?: string; supabase_video_path?: string | null; thumbnail_url?: string | null; render_error?: string | null }
    | undefined;
  const videoPath = projectMeta?.supabase_video_path;
  const vs = projectMeta?.video_status ?? data?.project.status ?? "idle";

  const { data: signed } = useQuery({
    queryKey: ["video-url", projectId, videoPath],
    queryFn: () => videoUrlFn({ data: { projectId } }),
    enabled: vs === "ready" && !!videoPath,
    refetchInterval: 55 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const { project, script, storyboard } = data;
  const scenes: Scene[] = (storyboard?.scenes_json as unknown as Scene[]) ?? [];
  const hasVisuals = scenes.some((s) => s.image_url);
  const visualCost = 0;
  const totalDuration = scenes.reduce((s, x) => s + (x.duration_s || 3), 0);
  const renderCost = 8;
  const thumbnail = projectMeta?.thumbnail_url;
  const renderError = projectMeta?.render_error;
  const isRendering = ["generating", "uploading", "processing"].includes(vs);
  const videoSrc = signed?.url ?? null;


  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {STATUS_LABEL[vs] ?? project.status}
          </div>
          <h1 className="font-display text-4xl">{project.title}</h1>
          {script?.hook && (
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground italic">"{script.hook}"</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={onGenerateVisuals}
            disabled={visualsLoading || !scenes.length || isRendering}
          >
            {visualsLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {hasVisuals ? "Regenerate visuals" : `Visuals (~${visualCost} cr)`}
          </Button>
          <Button
            variant="hero"
            onClick={onGenerateVideo}
            disabled={renderLoading || isRendering || !scenes.length}
          >
            {renderLoading || isRendering ? <Loader2 className="animate-spin" /> : <Clapperboard />}
            {vs === "ready" ? "Regenerate video" : `Generate final video (~${renderCost} cr)`}
          </Button>
        </div>
      </div>

      {/* Final video */}
      {vs === "ready" && videoSrc && (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl">Final ad</h2>
          <VideoPlayer src={videoSrc} poster={thumbnail ?? undefined} />
          <div className="mt-3 flex gap-2">
            <a
              href={videoSrc}
              download={`${project.title}.mp4`}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4" /> Download MP4
            </a>
          </div>
        </section>
      )}

      {isRendering && (
        <section className="panel mb-10 flex items-center gap-4 p-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div>
            <div className="font-display">{STATUS_LABEL[vs]}</div>
            <div className="text-sm text-muted-foreground">
              This takes a few minutes. You can leave this page — we'll keep rendering.
            </div>
          </div>
        </section>
      )}

      {vs === "error" && renderError && (
        <section className="panel mb-10 border-destructive/40 p-6">
          <div className="font-display text-destructive">Render failed</div>
          <p className="mt-1 text-sm text-muted-foreground">{renderError}</p>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-4 font-display text-2xl">Storyboard</h2>
          <div className="space-y-4">
            {scenes.map((s) => (
              <div key={s.index} className="panel overflow-hidden">
                {s.image_url && (
                  <img
                    src={s.image_url}
                    alt={`Scene ${s.index + 1}`}
                    className="aspect-video w-full object-cover"
                  />
                )}
                <div className="p-6">
                  <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full border border-border px-2 py-0.5">
                        Scene {s.index + 1}
                      </div>
                      <div className="rounded-full border border-border px-2 py-0.5">{s.shot}</div>
                      <div>{s.duration_s}s</div>
                    </div>
                    <Film className="h-4 w-4 text-primary" />
                  </div>
                  <div className="font-display text-lg">{s.visual}</div>
                  {s.voiceover && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="text-primary">VO:</span> {s.voiceover}
                    </p>
                  )}
                  {s.on_screen_text && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="text-primary">Text:</span> {s.on_screen_text}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          {script && (
            <div className="panel p-6">
              <h3 className="mb-3 font-display text-lg">Voiceover</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {script.voiceover_text}
              </p>
            </div>
          )}
          <div className="panel p-6">
            <h3 className="mb-3 font-display text-lg">Pipeline</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Script &amp; storyboard</li>
              <li>{hasVisuals ? "✓" : "·"} Scene visuals</li>
              <li>{vs === "ready" ? "✓" : isRendering ? "…" : "·"} Final video render</li>
              <li>· Publish to Meta / TikTok</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
