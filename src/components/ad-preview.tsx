import { useEffect, useMemo, useRef, useState } from "react";
import type { AdPlan, AspectRatio } from "@/lib/ad-types";
import { dimensionsFor } from "@/lib/ad-types";
import { drawAdFrame, loadPlanImages, planTotal, type ImageMap } from "@/lib/render/ad-renderer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, RotateCcw } from "lucide-react";

export function AdPreview({
  plan,
  aspect,
  className,
}: {
  plan: AdPlan;
  aspect: AspectRatio;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [images, setImages] = useState<ImageMap>({});
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);
  const total = useMemo(() => planTotal(plan), [plan]);
  const { width, height } = dimensionsFor(aspect);

  useEffect(() => {
    let alive = true;
    loadPlanImages(plan).then((m) => {
      if (alive) setImages(m);
    });
    return () => {
      alive = false;
    };
  }, [plan]);

  // Draw current frame whenever paused state / plan / time changes.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawAdFrame(ctx, { plan, width, height, time, images });
  }, [plan, time, images, width, height]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let next = timeRef.current + dt;
      if (next >= total) {
        next = total;
        setPlaying(false);
      }
      timeRef.current = next;
      setTime(next);
      if (next < total) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  function seek(v: number) {
    timeRef.current = v;
    setTime(v);
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl border border-border bg-black">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block h-auto w-full"
          style={{ aspectRatio: aspect.replace(":", " / ") }}
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            if (time >= total) seek(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setPlaying(false); seek(0); }}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Slider
          value={[time]}
          min={0}
          max={Math.max(1, total)}
          step={0.05}
          onValueChange={([v]) => {
            setPlaying(false);
            seek(v ?? 0);
          }}
          className="flex-1"
        />
        <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
          {time.toFixed(1)}s / {total.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
