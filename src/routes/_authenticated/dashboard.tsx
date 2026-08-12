import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/studio.functions";
import { ListVideo, Palette, Plus, Sparkles, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(listProjects);
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => fn() });

  const startOptions = [
    { to: "/create", title: "Single ad", desc: "Answer a few questions and get a script, storyboard and video.", icon: Sparkles },
    { to: "/series/new", title: "Ad series", desc: "3, 7 or 10 connected episodes with continuity.", icon: ListVideo },
    { to: "/brands", title: "From a brand kit", desc: "Start from a saved brand, logo and colours.", icon: Palette },
    { to: "/cast", title: "With a cast member", desc: "Reuse a consistent character across your ads.", icon: UserRound },
  ] as const;

  return (
    <AppShell>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl">Your studio</h1>
          <p className="mt-1 text-muted-foreground">Pick up where you left off, or start a new spot.</p>
        </div>
        <Link to="/create">
          <Button variant="hero"><Plus /> New ad</Button>
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-2xl">Start an ad</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {startOptions.map((o) => (
            <Link
              key={o.to}
              to={o.to}
              className="panel flex flex-col gap-2 p-5 transition-colors hover:border-primary/40"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary">
                <o.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="font-display text-lg">{o.title}</div>
              <p className="text-sm text-muted-foreground">{o.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {projects.length === 0 ? (
        <div className="panel grain flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-full [background:var(--gradient-ember)]">
            <Sparkles className="h-6 w-6 text-ember-foreground" />
          </div>
          <h2 className="font-display text-2xl">Roll your first take</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Describe the ad you want, pick a brand, and EASY ADs writes the script, storyboard,
            and directs the shoot for you.
          </p>
          <div className="mt-6 flex gap-2">
            <Link to="/create"><Button variant="hero">Create an ad</Button></Link>
            <Link to="/brands"><Button variant="cinematic">Add a brand</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const vs = (p as { video_status?: string }).video_status ?? "idle";
            const thumb = p.thumbnail_url;
            return (
              <Link
                key={p.id}
                to="/ads/$adId"
                params={{ adId: p.id }}
                className="panel group relative overflow-hidden transition-all hover:border-primary/40"
              >
                <div className="relative aspect-video overflow-hidden bg-black/40">
                  {thumb ? (
                    <img src={thumb} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <Sparkles className="h-6 w-6" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] uppercase tracking-widest backdrop-blur">
                    {vs === "ready" ? "▶ ready" : vs === "idle" ? p.status : vs}
                  </div>
                </div>
                <div className="p-5">
                  <div className="line-clamp-2 font-display text-lg">{p.title}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
