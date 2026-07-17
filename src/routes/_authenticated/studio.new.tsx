import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listBrands } from "@/lib/brand.functions";
import { generateScript } from "@/lib/studio.functions";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/studio/new")({
  component: NewProject,
});

const MODES = [
  { id: "prompt", name: "Prompt → Video", desc: "Start from a text idea" },
  { id: "image", name: "Image → Video", desc: "Animate a reference image", soon: true },
  { id: "url", name: "URL → Ad", desc: "Turn a product page into an ad", soon: true },
  { id: "extend", name: "Extend Video", desc: "Continue a clip", soon: true },
  { id: "elements", name: "Add Elements", desc: "Insert products & captions", soon: true },
  { id: "style", name: "Style Gallery", desc: "Pick a look and remix", soon: true },
];

function NewProject() {
  const navigate = useNavigate();
  const brandsFn = useServerFn(listBrands);
  const generateFn = useServerFn(generateScript);
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: () => brandsFn() });

  const [mode, setMode] = useState("prompt");
  const [brief, setBrief] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
  const [duration, setDuration] = useState("15");
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (brief.trim().length < 10) return toast.error("Add a bit more detail to your brief.");
    setLoading(true);
    try {
      const res = await generateFn({
        data: {
          brief,
          brandId: brandId === "none" ? undefined : brandId,
          duration: parseInt(duration, 10),
          aspect,
        },
      });
      toast.success("Script & storyboard ready");
      navigate({ to: "/studio/$projectId", params: { projectId: res.projectId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">New ad</h1>
        <p className="mt-1 text-muted-foreground">Pick a mode, then brief the director.</p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => !m.soon && setMode(m.id)}
            disabled={m.soon}
            className={`panel relative p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === m.id ? "border-primary shadow-[var(--shadow-glow)]" : "hover:border-primary/40"
            }`}
          >
            <div className="font-display text-lg">{m.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{m.desc}</div>
            {m.soon && (
              <div className="absolute right-3 top-3 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Soon
              </div>
            )}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="panel space-y-6 p-8">
        <div className="space-y-2">
          <Label>Creative brief</Label>
          <Textarea
            rows={6}
            placeholder="e.g. A 15-second cinematic spot for our new espresso blend — warm, morning light, close-ups of steam, ending with the product on a marble counter."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Brand</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No brand</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6s</SelectItem>
                <SelectItem value="15">15s</SelectItem>
                <SelectItem value="30">30s</SelectItem>
                <SelectItem value="60">60s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Aspect</Label>
            <Select value={aspect} onValueChange={(v) => setAspect(v as typeof aspect)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16 · Vertical</SelectItem>
                <SelectItem value="1:1">1:1 · Square</SelectItem>
                <SelectItem value="16:9">16:9 · Cinema</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-6">
          <div className="text-xs text-muted-foreground">
            Uses ~4 credits for script + storyboard.
          </div>
          <Button type="submit" variant="hero" size="lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Generate
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
