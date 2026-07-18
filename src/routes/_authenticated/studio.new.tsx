import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listBrands } from "@/lib/brand.functions";
import { generateScript, listProjects } from "@/lib/studio.functions";
import { STYLE_PRESETS } from "@/lib/styles";
import { toast } from "sonner";
import { Sparkles, Loader2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/studio/new")({
  component: NewProject,
});

type Mode = "prompt" | "image" | "url" | "extend" | "elements" | "style";

const MODES: { id: Mode; name: string; desc: string }[] = [
  { id: "prompt", name: "Prompt → Video", desc: "Start from a text idea" },
  { id: "image", name: "Image → Video", desc: "Animate a reference image" },
  { id: "url", name: "URL → Ad", desc: "Turn a product page into an ad" },
  { id: "extend", name: "Extend Video", desc: "Continue an existing spot" },
  { id: "elements", name: "Add Elements", desc: "Insert products & captions" },
  { id: "style", name: "Style Gallery", desc: "Pick a look and remix" },
];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function NewProject() {
  const navigate = useNavigate();
  const brandsFn = useServerFn(listBrands);
  const projectsFn = useServerFn(listProjects);
  const generateFn = useServerFn(generateScript);
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: () => brandsFn() });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => projectsFn() });

  const [mode, setMode] = useState<Mode>("prompt");
  const [brief, setBrief] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
  const [duration, setDuration] = useState("15");
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [loading, setLoading] = useState(false);

  // Mode-specific state
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [imageName, setImageName] = useState<string>("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceProjectId, setSourceProjectId] = useState<string>("");
  const [styleId, setStyleId] = useState<string>(STYLE_PRESETS[0].id);
  const [elementsText, setElementsText] = useState("");

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setImageDataUrl(await fileToDataUrl(f));
    setImageName(f.name);
  }

  function clearImage() {
    setImageDataUrl(undefined);
    setImageName("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Per-mode validation
    if (mode === "prompt" && brief.trim().length < 10)
      return toast.error("Add a bit more detail to your brief.");
    if (mode === "image" && !imageDataUrl) return toast.error("Upload a reference image.");
    if (mode === "url" && !sourceUrl) return toast.error("Paste a product URL.");
    if (mode === "extend" && !sourceProjectId) return toast.error("Pick a project to extend.");
    if (mode === "elements" && !elementsText.trim()) return toast.error("Add at least one element.");

    setLoading(true);
    try {
      const elements = elementsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await generateFn({
        data: {
          brief: brief || `${mode} ad`,
          brandId: brandId === "none" ? undefined : brandId,
          duration: parseInt(duration, 10),
          aspect,
          mode,
          imageDataUrl: mode === "image" ? imageDataUrl : undefined,
          sourceUrl: mode === "url" ? sourceUrl : undefined,
          sourceProjectId: mode === "extend" ? sourceProjectId : undefined,
          styleId: mode === "style" ? styleId : undefined,
          elements: mode === "elements" ? elements : undefined,
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
            type="button"
            onClick={() => setMode(m.id)}
            className={`panel relative p-5 text-left transition-all ${
              mode === m.id ? "border-primary shadow-[var(--shadow-glow)]" : "hover:border-primary/40"
            }`}
          >
            <div className="font-display text-lg">{m.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{m.desc}</div>
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="panel space-y-6 p-8">
        {/* Mode-specific inputs */}
        {mode === "image" && (
          <div className="space-y-2">
            <Label>Reference image</Label>
            {imageDataUrl ? (
              <div className="flex items-start gap-4">
                <img src={imageDataUrl} alt={imageName} className="h-32 w-32 rounded-md border border-border object-cover" />
                <div className="flex-1">
                  <div className="text-sm">{imageName}</div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearImage}>
                    <X className="h-3 w-3" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-8 text-sm text-muted-foreground hover:border-primary/40">
                <Upload className="h-4 w-4" /> Click to upload (PNG/JPG, max 5MB)
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            )}
          </div>
        )}

        {mode === "url" && (
          <div className="space-y-2">
            <Label>Product URL</Label>
            <Input
              type="url"
              placeholder="https://your-store.com/product"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
        )}

        {mode === "extend" && (
          <div className="space-y-2">
            <Label>Continue from</Label>
            <Select value={sourceProjectId} onValueChange={setSourceProjectId}>
              <SelectTrigger><SelectValue placeholder="Pick a project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mode === "elements" && (
          <div className="space-y-2">
            <Label>Elements to insert (one per line)</Label>
            <Textarea
              rows={4}
              placeholder={"Product close-up on a marble counter\nCaption: 'Now 20% off'\nLogo lock-up on final frame"}
              value={elementsText}
              onChange={(e) => setElementsText(e.target.value)}
            />
          </div>
        )}

        {mode === "style" && (
          <div className="space-y-2">
            <Label>Style</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STYLE_PRESETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleId(s.id)}
                  className={`panel p-4 text-left transition-all ${
                    styleId === s.id ? "border-primary" : "hover:border-primary/40"
                  }`}
                >
                  <div className="font-display">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.tagline}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Creative brief {mode !== "prompt" && <span className="text-muted-foreground">(optional context)</span>}</Label>
          <Textarea
            rows={5}
            placeholder="e.g. A 15-second cinematic spot for our new espresso blend — warm morning light, steam close-ups, product on marble."
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
            Uses ~4 credits for script + storyboard. Scene visuals cost 3 credits per scene.
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
