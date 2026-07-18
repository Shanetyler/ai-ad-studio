import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getProject, generateSceneVisuals } from "@/lib/studio.functions";
import { Loader2, Film, Wand2 } from "lucide-react";
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

function ProjectView() {
  const { projectId } = Route.useParams();
  const fn = useServerFn(getProject);
  const visualsFn = useServerFn(generateSceneVisuals);
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fn({ data: { id: projectId } }),
  });

  async function onGenerateVisuals() {
    setGenerating(true);
    try {
      await visualsFn({ data: { projectId } });
      toast.success("Scene visuals rendered");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["credits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

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
  const cost = scenes.length * 3;

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{project.status}</div>
          <h1 className="font-display text-4xl">{project.title}</h1>
          {script?.hook && <p className="mt-3 max-w-2xl text-lg text-muted-foreground italic">"{script.hook}"</p>}
        </div>
        <Button variant="hero" onClick={onGenerateVisuals} disabled={generating || !scenes.length}>
          {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {hasVisuals ? "Regenerate visuals" : `Generate visuals (~${cost} credits)`}
        </Button>
      </div>

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
                      <div className="rounded-full border border-border px-2 py-0.5">Scene {s.index + 1}</div>
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
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{script.voiceover_text}</p>
            </div>
          )}
          <div className="panel p-6">
            <h3 className="mb-3 font-display text-lg">Pipeline</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Script &amp; storyboard</li>
              <li>{hasVisuals ? "✓" : "·"} Scene visuals</li>
              <li>· Voiceover audio</li>
              <li>· Music &amp; SFX</li>
              <li>· Final video render</li>
              <li>· Publish to Meta / TikTok</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
