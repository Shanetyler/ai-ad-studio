import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listBrands, researchBrand } from "@/lib/brand.functions";
import { toast } from "sonner";
import { Globe, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/brands")({
  component: BrandsPage,
});

function BrandsPage() {
  const listFn = useServerFn(listBrands);
  const researchFn = useServerFn(researchBrand);
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: () => listFn() });

  async function onResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url)) return toast.error("Enter a full URL (https://…)");
    setLoading(true);
    try {
      const res = await researchFn({ data: { url } });
      toast.success(`Brand created: ${res.brand.name}`);
      setUrl("");
      qc.invalidateQueries({ queryKey: ["brands"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Brands</h1>
        <p className="mt-1 text-muted-foreground">Paste a URL — we build the brand profile.</p>
      </div>

      <form onSubmit={onResearch} className="panel mb-10 p-6">
        <Label>Brand website</Label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="https://your-brand.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="hero" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            Research brand
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          We scan the page and use AI to extract tone, colors, products and ad hooks.
        </p>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <div key={b.id} className="panel p-6">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-md border border-border"
                style={{
                  background:
                    b.primary_color && b.secondary_color
                      ? `linear-gradient(135deg, ${b.primary_color}, ${b.secondary_color})`
                      : "var(--gradient-ember)",
                }}
              />
              <div className="min-w-0">
                <div className="truncate font-display text-lg">{b.name}</div>
                <div className="truncate text-xs text-muted-foreground">{b.website_url}</div>
              </div>
            </div>
            {b.tagline && <p className="mt-4 text-sm text-muted-foreground">{b.tagline}</p>}
            {b.tone && (
              <div className="mt-4 inline-flex rounded-full border border-border bg-secondary px-2 py-0.5 text-xs">
                {b.tone}
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
