import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listBrands } from "@/lib/brand.functions";
import { createSeries } from "@/lib/series.functions";
import { STYLE_PRESETS } from "@/lib/styles";
import { toast } from "sonner";
import { ListVideo, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/series/new")({
  head: () => ({
    meta: [
      { title: "New Ad Series — EASY ADs" },
      { name: "description", content: "Plan a connected 3, 7, or 10-video ad series with shared characters, style, voice, and timeline." },
      { property: "og:title", content: "New Ad Series — EASY ADs" },
      { property: "og:description", content: "Sequential ad episodes with continuity across characters, style, offer, and countdown." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewSeries,
});

const LENGTHS = [3, 7, 10] as const;
const TIMELINES = [
  { id: "campaign", label: "Campaign arc", hint: "Awareness → consideration → conversion" },
  { id: "countdown", label: "Countdown", hint: "Days-to-deadline urgency (Day 1, Day 3, Day 7…)" },
  { id: "launch", label: "Product launch", hint: "Tease → reveal → offer → last call" },
] as const;

function NewSeries() {
  const nav = useNavigate();
  const createFn = useServerFn(createSeries);
  const brandsFn = useServerFn(listBrands);
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => brandsFn() });

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [length, setLength] = useState<3 | 7 | 10>(3);
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [brandId, setBrandId] = useState<string | undefined>();
  const [timelineType, setTimelineType] = useState<"campaign" | "countdown" | "launch">("campaign");
  const [styleId, setStyleId] = useState<string | undefined>();

  const [character, setCharacter] = useState("");
  const [style, setStyle] = useState("");
  const [voice, setVoice] = useState("");
  const [offer, setOffer] = useState("");
  const [deadline, setDeadline] = useState("");

  const [keepCharacter, setKeepCharacter] = useState(true);
  const [keepStyle, setKeepStyle] = useState(true);
  const [keepVoice, setKeepVoice] = useState(true);
  const [keepOffer, setKeepOffer] = useState(true);
  const [keepDeadline, setKeepDeadline] = useState(true);

  const scriptCredits = length * 2;
  const fullSeriesCredits = length * 10;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (brief.length < 10) return toast.error("Add a longer series brief");
    setLoading(true);
    try {
      const res = await createFn({
        data: {
          title: title || brief.slice(0, 60),
          brief,
          length,
          aspect,
          brandId,
          timelineType,
          styleId,
          duration: 15,
          continuity: {
            character: character || undefined,
            style: style || undefined,
            voice: voice || undefined,
            offer: offer || undefined,
            deadline: deadline || undefined,
            keepCharacter, keepStyle, keepVoice, keepOffer, keepDeadline,
          },
        },
      });
      toast.success(`Series planned — ${res.projects.length} episodes ready`);
      nav({ to: "/series/$seriesId", params: { seriesId: res.seriesId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create series");
    } finally {
      setLoading(false);
    }
  }

  const ContinuityRow = ({
    label, value, setValue, keepOn, setKeepOn, placeholder,
  }: {
    label: string; value: string; setValue: (v: string) => void;
    keepOn: boolean; setKeepOn: (v: boolean) => void; placeholder: string;
  }) => (
    <div className="grid gap-2 rounded-md border border-border/60 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Keep consistent</span>
          <Switch checked={keepOn} onCheckedChange={setKeepOn} />
        </div>
      </div>
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">New series</div>
          <h1 className="font-display text-4xl">Plan a connected ad series</h1>
          <p className="mt-2 text-muted-foreground">
            3, 7, or 10 episodes that build a linear storyline. Same credit cost per episode as a solo ad —
            script 2, render 8, total <span className="text-primary">10 credits</span> per finished video.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-2">
            <Label>Series title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer Sale Countdown" />
          </div>

          <div className="grid gap-2">
            <Label>Series brief *</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe the whole campaign: the product, the offer, the audience, and how the storyline should build."
              rows={5}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Length</Label>
              <div className="flex gap-2">
                {LENGTHS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLength(n)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      length === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {n} eps
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Aspect</Label>
              <Select value={aspect} onValueChange={(v) => setAspect(v as typeof aspect)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 vertical</SelectItem>
                  <SelectItem value="1:1">1:1 square</SelectItem>
                  <SelectItem value="16:9">16:9 wide</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Timeline</Label>
              <Select value={timelineType} onValueChange={(v) => setTimelineType(v as typeof timelineType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMELINES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TIMELINES.find((t) => t.id === timelineType)?.hint}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Brand (optional)</Label>
              <Select value={brandId ?? "none"} onValueChange={(v) => setBrandId(v === "none" ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="No brand" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No brand</SelectItem>
                  {(brands ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Visual style (optional)</Label>
              <Select value={styleId ?? "none"} onValueChange={(v) => setStyleId(v === "none" ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="No preset" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset</SelectItem>
                  {STYLE_PRESETS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-display text-xl">Continuity across episodes</h3>
              <p className="text-sm text-muted-foreground">
                Toggle what should stay identical from episode to episode. Fields you leave blank let the AI invent.
              </p>
            </div>
            <ContinuityRow
              label="Character / spokesperson"
              value={character} setValue={setCharacter}
              keepOn={keepCharacter} setKeepOn={setKeepCharacter}
              placeholder="e.g. 30-something founder in a denim jacket, warm smile"
            />
            <ContinuityRow
              label="Visual theme / style / branding"
              value={style} setValue={setStyle}
              keepOn={keepStyle} setKeepOn={setKeepStyle}
              placeholder="e.g. sunlit lifestyle, warm ochre + ivory palette, film grain"
            />
            <ContinuityRow
              label="Voiceover / narrator"
              value={voice} setValue={setVoice}
              keepOn={keepVoice} setKeepOn={setKeepVoice}
              placeholder="e.g. calm female narrator, mid-30s, confident"
            />
            <ContinuityRow
              label="Promotional offer / deal"
              value={offer} setValue={setOffer}
              keepOn={keepOffer} setKeepOn={setKeepOffer}
              placeholder="e.g. 30% off sitewide + free shipping over $50"
            />
            <ContinuityRow
              label="Time-sensitive event / deadline"
              value={deadline} setValue={setDeadline}
              keepOn={keepDeadline} setKeepOn={setKeepDeadline}
              placeholder="e.g. ends Friday at midnight — 7-day countdown"
            />
          </div>

          <div className="panel flex items-center justify-between p-4 text-sm">
            <div>
              <div className="font-display">Cost estimate</div>
              <div className="text-muted-foreground">
                Scripts now: <span className="text-primary">{scriptCredits} credits</span> · Full rendered series:{" "}
                <span className="text-primary">{fullSeriesCredits} credits</span>
              </div>
            </div>
            <Button type="submit" variant="hero" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <ListVideo />}
              {loading ? "Planning…" : "Generate series"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
