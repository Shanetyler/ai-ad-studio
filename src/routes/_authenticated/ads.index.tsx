import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy, Film, Plus, Trash2 } from "lucide-react";
import { deleteAd, duplicateAd, listAds } from "@/lib/ads.functions";

export const Route = createFileRoute("/_authenticated/ads/")({
  head: () => ({
    meta: [
      { title: "My ads — EASY ADs" },
      { name: "description", content: "Every ad you have created, with export status, duration and quick actions to edit, duplicate or delete." },
      { property: "og:title", content: "My ads — EASY ADs" },
      { property: "og:description", content: "Your ad library: drafts, storyboards and exported video files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdsLibrary,
});

const STATUS_LABEL: Record<string, string> = {
  idle: "Draft",
  rendering: "Exporting",
  ready: "Exported",
  failed: "Export failed",
};

function AdsLibrary() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAds);
  const delFn = useServerFn(deleteAd);
  const dupFn = useServerFn(duplicateAd);

  const { data: ads, isLoading, isError, error } = useQuery({
    queryKey: ["ads"],
    queryFn: () => listFn(),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: (projectId: string) => delFn({ data: { projectId } }),
    onSuccess: () => {
      toast.success("Ad deleted");
      queryClient.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const duplicate = useMutation({
    mutationFn: (projectId: string) => dupFn({ data: { projectId } }),
    onSuccess: () => {
      toast.success("Copy created");
      queryClient.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not duplicate"),
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">My ads</h1>
          <p className="text-muted-foreground">Edit, re-export or duplicate any ad you’ve made.</p>
        </div>
        <Button variant="hero" asChild><Link to="/create"><Plus /> New ad</Link></Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      )}

      {isError && (
        <div className="panel p-6">
          <p className="font-medium">We couldn’t load your ads</p>
          <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
          <Button className="mt-4" variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["ads"] })}>Try again</Button>
        </div>
      )}

      {ads && ads.length === 0 && (
        <div className="panel grid place-items-center p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary"><Film className="h-5 w-5 text-primary" /></div>
          <h2 className="mt-4 font-display text-2xl">No ads yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Create your first ad in about two minutes — answer a few questions and EASY ADs writes the script, builds the
            storyboard and exports a downloadable video.
          </p>
          <Button variant="hero" className="mt-5" asChild><Link to="/create">Create my first ad</Link></Button>
        </div>
      )}

      {ads && ads.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ads.map((ad) => (
            <div key={ad.id} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to="/ads/$adId" params={{ adId: ad.id }} className="min-w-0 font-display text-lg hover:text-primary">
                  {ad.title}
                </Link>
                <Badge variant={ad.video_status === "ready" ? "default" : "secondary"}>
                  {STATUS_LABEL[ad.video_status ?? "idle"] ?? ad.video_status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {ad.aspect_ratio} · {ad.tone ?? "—"} · {ad.duration_seconds ? `${Math.round(Number(ad.duration_seconds))}s` : "not exported"}
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {(ad.plan_json as { hook?: string } | null)?.hook ?? "No storyboard yet"}
              </p>
              <div className="mt-auto flex items-center gap-2">
                <Button size="sm" asChild><Link to="/ads/$adId" params={{ adId: ad.id }}>Open</Link></Button>
                <Button size="sm" variant="ghost" aria-label="Duplicate" onClick={() => duplicate.mutate(ad.id)} disabled={duplicate.isPending}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => remove.mutate(ad.id)} disabled={remove.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
