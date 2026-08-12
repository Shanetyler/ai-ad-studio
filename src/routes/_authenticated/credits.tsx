import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Coins } from "lucide-react";
import { getCredits } from "@/lib/studio.functions";

export const Route = createFileRoute("/_authenticated/credits")({
  head: () => ({
    meta: [
      { title: "Top up credits — EASY ADs" },
      { name: "description", content: "Choose a credit pack and keep making ads. Every finished EASY ADs video costs 10 credits." },
      { property: "og:title", content: "Top up credits — EASY ADs" },
      { property: "og:description", content: "Credit packs for EASY ADs — 10 credits per finished ad video." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreditsPage,
});

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    credits: 100,
    price: "$19",
    blurb: "10 finished ads",
    perks: ["10 complete ad videos", "In-browser export", "All aspect ratios"],
  },
  {
    id: "growth",
    name: "Growth",
    credits: 300,
    price: "$49",
    blurb: "30 finished ads",
    popular: true,
    perks: ["30 complete ad videos", "Ad series planning", "Brand kits & cast continuity"],
  },
  {
    id: "studio",
    name: "Studio",
    credits: 1000,
    price: "$139",
    blurb: "100 finished ads",
    perks: ["100 complete ad videos", "Priority generation", "Best price per credit"],
  },
] as const;

function CreditsPage() {
  const creditsFn = useServerFn(getCredits);
  const { data } = useQuery({ queryKey: ["credits"], queryFn: () => creditsFn(), retry: false });
  const [selected, setSelected] = useState<string>("growth");

  const tier = TIERS.find((t) => t.id === selected)!;

  function continueToPayment() {
    toast.info("Checkout isn’t connected yet", {
      description: `${tier.name} — ${tier.credits} credits for ${tier.price}. Connect a payment provider to enable purchases.`,
    });
  }

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Top up credits</h1>
        <p className="mt-1 text-muted-foreground">
          Each finished ad video costs 10 credits. You currently have{" "}
          <span className="text-primary">{data?.credits ?? 0}</span> credits.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              aria-pressed={active}
              className={`panel flex flex-col p-6 text-left transition-colors ${
                active ? "border-primary/60" : "hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-display text-2xl">{t.name}</div>
                {t.popular && <Badge>Most popular</Badge>}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl">{t.price}</span>
                <span className="text-sm text-muted-foreground">one-off</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="h-4 w-4 text-primary" /> {t.credits} credits · {t.blurb}
              </div>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" /> {p}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="text-sm text-muted-foreground">
          Selected: <span className="text-foreground">{tier.name}</span> — {tier.credits} credits for {tier.price}
        </div>
        <Button variant="hero" onClick={continueToPayment}>Continue to payment</Button>
      </div>
    </AppShell>
  );
}
