import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { getSeries } from "@/lib/series.functions";
import { Loader2, Film, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/series/$seriesId")({
  head: () => ({
    meta: [
      { title: "Ad Series — EASY ADs" },
      { name: "description", content: "Review a connected ad series episode by episode and render each video." },
      { property: "og:title", content: "Ad Series — EASY ADs" },
      { property: "og:description", content: "Connected ad episodes with shared characters, style, offer, and timeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeriesView,
});

const STATUS_LABEL: Record<string, string> = {
  idle: "Ready to render",
  generating: "Generating…",
  uploading: "Uploading…",
  processing: "Processing…",
  ready: "Ready",
  error: "Error",
};

function SeriesView() {
  const { seriesId } = Route.useParams();
  const fn = useServerFn(getSeries);
  const { data, isLoading } = useQuery({
    queryKey: ["series", seriesId],
    queryFn: () => fn({ data: { id: seriesId } }),
    refetchInterval: 15000,
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

  const { series, projects } = data;
  const continuity = (series.continuity_json ?? {}) as Record<string, unknown>;
  const kept = ["keepCharacter", "keepStyle", "keepVoice", "keepOffer", "keepDeadline"]
    .filter((k) => continuity[k] === true)
    .map((k) => k.replace("keep", ""));

  return (
    <AppShell>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {series.timeline_type} · {series.length} episodes · {series.status}
        </div>
        <h1 className="font-display text-4xl">{series.title}</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">{series.brief}</p>
        {kept.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {kept.map((k) => (
              <span key={k} className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                Consistent {k.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {projects.map((p) => {
          const vs = (p as { video_status?: string }).video_status ?? "idle";
          return (
            <Link
              key={p.id}
              to="/studio/$projectId"
              params={{ projectId: p.id }}
              className="panel flex items-center gap-4 p-4 transition-colors hover:border-primary/50"
            >
              <div className="w-14 shrink-0 text-center">
                <div className="text-xs uppercase text-muted-foreground">Ep</div>
                <div className="font-display text-2xl">{(p.series_index ?? 0) + 1}</div>
              </div>
              {p.thumbnail_url ? (
                <img src={p.thumbnail_url} alt="" className="h-20 w-32 shrink-0 rounded object-cover" />
              ) : (
                <div className="grid h-20 w-32 shrink-0 place-items-center rounded bg-secondary/50">
                  <Film className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-display">{p.title}</div>
                <div className="text-xs text-muted-foreground">{STATUS_LABEL[vs] ?? p.status}</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
