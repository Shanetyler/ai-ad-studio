import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Film } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — EASY ADs" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

function safeNext(next?: string) {
  if (!next) return undefined;
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const nextPath = safeNext(next);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  function goAfterAuth() {
    if (nextPath) {
      window.location.href = nextPath;
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (nextPath) window.location.href = nextPath;
        else navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [navigate, nextPath]);

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: nextPath ? `${window.location.origin}${nextPath}` : window.location.origin,
    });
    setLoading(false);
    if (result.error) return toast.error(result.error.message || "Google sign-in failed");
    if (result.redirected) return;
    goAfterAuth();
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    goAfterAuth();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: nextPath ? `${window.location.origin}${nextPath}` : window.location.origin,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Redirecting…");
    goAfterAuth();
  }


  return (
    <div className="relative flex min-h-screen items-center justify-center bg-hero px-4">
      <Link to="/" className="absolute left-6 top-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <Film className="h-4 w-4" /> EASY ADs
      </Link>
      <div className="panel w-full max-w-md p-8">
        <h1 className="font-display text-3xl">Welcome</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in or create your studio account.</p>

        <Button onClick={handleGoogle} disabled={loading} variant="cinematic" className="mt-6 w-full">
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form className="space-y-4 pt-4" onSubmit={handleSignIn}>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={loading}>Sign in</Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form className="space-y-4 pt-4" onSubmit={handleSignUp}>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={loading}>Create account</Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
