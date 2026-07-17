import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/studio.functions";
import { Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(listProjects);
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => fn() });

  return (
    <AppShell>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl">Your studio</h1>
          <p className="mt-1 text-muted-foreground">Pick up where you left off, or start a new spot.</p>
        </div>
        <Link to="/studio/new">
          <Button variant="hero"><Plus /> New ad</Button>
        </Link>
      </div>

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
            <Link to="/studio/new"><Button variant="hero">Create an ad</Button></Link>
            <Link to="/brands"><Button variant="cinematic">Add a brand</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/studio/$projectId"
              params={{ projectId: p.id }}
              className="panel group relative overflow-hidden p-6 transition-all hover:border-primary/40"
            >
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{p.status}</div>
              <div className="mt-2 line-clamp-2 font-display text-xl">{p.title}</div>
              <div className="mt-6 text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
