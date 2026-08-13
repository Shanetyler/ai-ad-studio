import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Library, Play } from "lucide-react";
import { listAds } from "@/lib/ads.functions";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Video library — EASY ADs" },
      { name: "description", content: "Watch and download every finished ad video you have exported with EASY ADs." },
      { property: "og:title", content: "Video library — EASY ADs" },
      { property: "og:description", content: "All of your completed, exported ad videos in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoLibrary,
});

function VideoLibrary() {
  const listFn = useServerFn(listAds);
  const { data, isLoading } = useQuery({ queryKey: ["ads"], queryFn: () => listFn(), retry: false });
  const done = (data ?? []).filter((a) => a.video_status === "ready");

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-4xl">Video library</h1>
        <p className="text-muted-foreground">Every completed ad video, ready to watch, download or re-export.</p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      )}

      {!isLoading && done.length === 0 && (
        <div className="panel grid place-items-center p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary">
            <Library className="h-5 w-5 text-primary" />
          </div>
          <h2 className="mt-4 font-display text-2xl">No finished videos yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Once you export an ad, the finished video shows up here for playback and download.
          </p>
          <Button variant="hero" className="mt-5" asChild><Link to="/create">Create an ad</Link></Button>
        </div>
      )}

      {done.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {done.map((ad) => (
            <Link
              key={ad.id}
              to="/ads/$adId"
              params={{ adId: ad.id }}
              className="panel group overflow-hidden transition-colors hover:border-primary/40"
            >
              <div className="grid aspect-video place-items-center bg-secondary">
                <Play className="h-7 w-7 text-primary" />
              </div>
              <div className="p-4">
                <div className="line-clamp-2 font-display text-lg">{ad.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {ad.aspect_ratio} · {ad.duration_seconds ? `${Math.round(Number(ad.duration_seconds))}s` : "—"} ·{" "}
                  {new Date(ad.created_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
