import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Trash2, UserRound } from "lucide-react";
import { deleteCast, listCast, saveCast } from "@/lib/library.functions";

export const Route = createFileRoute("/_authenticated/cast")({
  head: () => ({
    meta: [
      { title: "Characters & voices — EASY ADs" },
      { name: "description", content: "Save reusable characters and voice profiles so every ad in your library stays on-brand and consistent." },
      { property: "og:title", content: "Characters & voices — EASY ADs" },
      { property: "og:description", content: "Your cast library: consistent characters and voice direction for every ad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CastLibrary;
});

function CastLibrary() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCast);
  const saveFn = useServerFn(saveCast);
  const delFn = useServerFn(deleteCast);

  const [kind, setKind] = useState<"character" | "voice">("character");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rights, setRights] = useState(false);

  const { data: cast, isLoading, isError, error } = useQuery({
    queryKey: ["cast"],
    queryFn: () => listFn(),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { kind, name: name.trim(), description: description.trim(), attributes: {}, rights_confirmed: rights } }),
    onSuccess: () => {
      toast.success(kind === "character" ? "Character saved" : "Voice saved");
      setName("");
      setDescription("");
      setRights(false);
      queryClient.invalidateQueries({ queryKey: ["cast"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      queryClient.invalidateQueries({ queryKey: ["cast"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  return (
    <AppShell>
      <h1 className="font-display text-4xl">Characters & voices</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Save the people and voice styles you want to reuse. These guide how the script describes your cast and keep a series
        consistent. EASY ADs does not clone faces or voices — provider integrations can be connected later.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="panel space-y-4 p-5">
          <Tabs value={kind} onValueChange={(v) => setKind(v as "character" | "voice")}>
            <TabsList className="w-full">
              <TabsTrigger value="character" className="flex-1">Character</TabsTrigger>
              <TabsTrigger value="voice" className="flex-1">Voice</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "character" ? "Friendly crew lead" : "Warm female narrator"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                kind === "character"
                  ? "Man in his 40s, navy work shirt, confident and approachable, always on a suburban lawn."
                  : "Warm mid-range female voice, conversational pace, upbeat but trustworthy."
              }
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3 text-sm">
            <Checkbox checked={rights} onCheckedChange={(v) => setRights(v === true)} className="mt-0.5" />
            <span className="text-muted-foreground">
              I confirm I own or have written permission to use this likeness and/or voice in advertising.
            </span>
          </label>

          <Button
            className="w-full"
            variant="hero"
            disabled={save.isPending || name.trim().length < 2 || !rights}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            Save {kind}
          </Button>
        </div>

        <div className="space-y-4">
          {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}

          {isError && (
            <div className="panel p-5">
              <p className="font-medium">We couldn’t load your cast library</p>
              <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
            </div>
          )}

          {cast && cast.length === 0 && (
            <div className="panel grid place-items-center p-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary"><UserRound className="h-5 w-5 text-primary" /></div>
              <h2 className="mt-4 font-display text-2xl">Nothing saved yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add a character or voice on the left. It becomes selectable in the create-ad wizard.
              </p>
            </div>
          )}

          {cast?.map((member) => (
            <div key={member.id} className="panel flex items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg">{member.name}</h3>
                  <Badge variant="secondary">{member.kind}</Badge>
                  {member.rights_confirmed && <Badge variant="outline">Rights confirmed</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{member.description || "No description"}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove.mutate(member.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
