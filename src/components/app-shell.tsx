import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, LayoutDashboard, Palette, LogOut, ListVideo, UserRound } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCredits } from "@/lib/studio.functions";
import { useEffect, useState, type ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const creditsFn = useServerFn(getCredits);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data } = useQuery({
    queryKey: ["credits"],
    queryFn: () => creditsFn(),
    enabled: hasSession,
    retry: false,
  });


  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/create", label: "New Ad", icon: Sparkles },
    { to: "/ads", label: "My Ads", icon: Film },
    { to: "/cast", label: "Cast", icon: UserRound },
    { to: "/brands", label: "Brands", icon: Palette },
    { to: "/series/new", label: "New Series", icon: ListVideo },
  ] as const;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border/50 bg-card/30 p-4 md:block">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-md [background:var(--gradient-ember)]">
            <Film className="h-4 w-4 text-ember-foreground" />
          </div>
          <span className="font-display text-lg">EASY ADs</span>
        </Link>
        <nav className="space-y-1">
          {nav.map((n) => {
            const active = path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border/50 px-6">
          <div className="text-sm text-muted-foreground">
            {path.split("/").filter(Boolean).join(" / ") || "dashboard"}
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-border bg-card px-3 py-1 text-xs">
              <span className="text-primary">{data?.credits ?? 0}</span>
              <span className="ml-1 text-muted-foreground">credits</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
