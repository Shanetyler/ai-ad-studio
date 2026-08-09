// Easy Ad in-browser render engine.
// Draws every frame on a canvas and records it with MediaRecorder, so a full ad
// can be produced with zero paid API calls.

import type { AdPlan, AspectRatio } from "@/lib/ad-types";
import { dimensionsFor } from "@/lib/ad-types";
import { findAsset } from "@/lib/media-library";
import { drawMotif } from "./motifs";

export type ImageMap = Record<string, HTMLImageElement>;

export function planTotal(plan: AdPlan): number {
  return plan.scenes.reduce((sum, s) => sum + (s.duration_s || 3), 0);
}

export function sceneAt(plan: AdPlan, time: number) {
  let acc = 0;
  for (let i = 0; i < plan.scenes.length; i++) {
    const s = plan.scenes[i]!;
    const d = s.duration_s || 3;
    if (time < acc + d || i === plan.scenes.length - 1) {
      return { scene: s, index: i, local: Math.max(0, time - acc), duration: d };
    }
    acc += d;
  }
  return { scene: plan.scenes[0]!, index: 0, local: 0, duration: 3 };
}

const FONTS: Record<AdPlan["font"], { head: string; body: string }> = {
  display: { head: '800 {size}px "Space Grotesk", system-ui, sans-serif', body: '600 {size}px system-ui, sans-serif' },
  sans: { head: '700 {size}px system-ui, sans-serif', body: '500 {size}px system-ui, sans-serif' },
  mono: { head: '700 {size}px "JetBrains Mono", ui-monospace, monospace', body: '500 {size}px ui-monospace, monospace' },
};

function font(plan: AdPlan, kind: "head" | "body", size: number) {
  return FONTS[plan.font][kind].replace("{size}", String(Math.round(size)));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function easeOut(p: number) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
}

/** Draws one frame of the ad. Used by both the live preview and the recorder. */
export function drawAdFrame(
  ctx: CanvasRenderingContext2D,
  opts: { plan: AdPlan; width: number; height: number; time: number; images?: ImageMap },
) {
  const { plan, width: w, height: h, time, images } = opts;
  const total = planTotal(plan);
  const t = Math.min(time, total);
  const { scene, index, local, duration } = sceneAt(plan, t);
  const progress = duration ? local / duration : 0;
  const asset = findAsset(scene.asset_id);
  const base = asset?.palette ?? ["#0b0f19", plan.palette.primary];
  const s = Math.min(w, h);
  const isLast = index === plan.scenes.length - 1;

  // Background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  const shift = Math.sin(time * 0.25) * 0.12;
  grad.addColorStop(0, base[0]!);
  grad.addColorStop(Math.min(0.95, 0.65 + shift), base[1]!);
  grad.addColorStop(1, base[0]!);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Scene media: uploaded/AI image with a slow ken-burns, else motion graphics
  const transition = plan.transition ?? "fade";
  const enter = Math.min(1, local / 0.45);
  const img = scene.image_url ? images?.[scene.image_url] : undefined;
  if (img) {
    const punch = transition === "zoom" ? (1 - easeOut(enter)) * 0.14 : 0;
    const zoom = 1.06 + 0.08 * progress + punch;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const slide = transition === "slide" ? (1 - easeOut(enter)) * w * 0.18 : 0;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(img, (w - dw) / 2 + slide, (h - dh) / 2 - progress * s * 0.02, dw, dh);
    ctx.restore();
  } else if (asset) {
    drawMotif(ctx, asset.motif, { w, h, t: time, color: base[1]!, accent: plan.palette.primary });
  }

  // Vignette for text legibility
  const vg = ctx.createLinearGradient(0, h * 0.35, 0, h);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, w, h * 0.28);

  const pad = s * 0.07;

  // Hook headline on the opening scene
  if (index === 0 && plan.hook) {
    const appear = easeOut(local / 0.7);
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.textAlign = "center";
    ctx.font = font(plan, "head", s * 0.085);
    const lines = wrap(ctx, plan.hook, w - pad * 2);
    const lh = s * 0.1;
    let y = h * 0.34 - ((lines.length - 1) * lh) / 2 + (1 - appear) * s * 0.06;
    for (const line of lines) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillText(line, w / 2 + s * 0.006, y + s * 0.006);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line, w / 2, y);
      y += lh;
    }
    ctx.restore();
  }

  // Caption band
  if (plan.captions_enabled && scene.caption) {
    const appear = easeOut(local / 0.45);
    ctx.save();
    ctx.font = font(plan, "body", s * 0.055);
    const lines = wrap(ctx, scene.caption, w - pad * 2.4);
    const lh = s * 0.07;
    const boxH = lines.length * lh + s * 0.05;
    const boxY = h - pad - boxH - (isLast ? s * 0.16 : 0);
    ctx.globalAlpha = 0.85 * appear;
    ctx.fillStyle = "rgba(8,10,16,0.72)";
    roundRectPath(ctx, pad, boxY, w - pad * 2, boxH, s * 0.03);
    ctx.fill();
    ctx.globalAlpha = appear;
    ctx.textAlign = "center";
    let y = boxY + s * 0.055;
    for (const line of lines) {
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line, w / 2, y);
      y += lh;
    }
    ctx.restore();
  }

  // Closing card: CTA + contact
  if (isLast) {
    const appear = easeOut(local / 0.6);
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.textAlign = "center";
    ctx.fillStyle = plan.palette.primary;
    const ctaW = w - pad * 2;
    const btnH = s * 0.115;
    roundRectPath(ctx, pad, h - pad - btnH, ctaW, btnH, btnH / 2);
    ctx.fill();
    ctx.fillStyle = "#0b0f19";
    ctx.font = font(plan, "head", s * 0.055);
    ctx.fillText(plan.cta.slice(0, 46), w / 2, h - pad - btnH / 2 + s * 0.02);
    if (plan.contact_line) {
      ctx.font = font(plan, "body", s * 0.04);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(plan.contact_line, w / 2, h - pad - btnH - s * 0.035);
    }
    ctx.restore();
  }

  // Logo
  const logo = plan.logo_url ? images?.[plan.logo_url] : undefined;
  if (logo) {
    const lw = s * 0.22;
    const lh = (logo.naturalHeight / Math.max(1, logo.naturalWidth)) * lw;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, pad * 0.7, pad * 0.6, lw, lh);
    ctx.restore();
  }

  // Progress ticks
  ctx.save();
  const barY = pad * 0.42;
  const gap = s * 0.012;
  const segW = (w - pad * 1.4 - gap * (plan.scenes.length - 1)) / plan.scenes.length;
  for (let i = 0; i < plan.scenes.length; i++) {
    const x = pad * 0.7 + i * (segW + gap);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    roundRectPath(ctx, x, barY, segW, s * 0.008, s * 0.004);
    ctx.fill();
    const fill = i < index ? 1 : i === index ? progress : 0;
    if (fill > 0) {
      ctx.fillStyle = plan.palette.primary;
      roundRectPath(ctx, x, barY, segW * fill, s * 0.008, s * 0.004);
      ctx.fill();
    }
  }
  ctx.restore();

  // Scene-entry transition overlay
  if (transition === "fade" && enter < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - easeOut(enter);
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export async function loadPlanImages(plan: AdPlan): Promise<ImageMap> {
  const urls = [plan.logo_url, ...plan.scenes.map((s) => s.image_url)].filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  const entries = await Promise.all(
    Array.from(new Set(urls)).map(
      (url) =>
        new Promise<[string, HTMLImageElement] | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve([url, img]);
          img.onerror = () => resolve(null);
          img.src = url;
        }),
    ),
  );
  return Object.fromEntries(entries.filter((e): e is [string, HTMLImageElement] => !!e));
}

function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

/** Simple generated music bed so the recording carries an audio track. */
function buildMusicBed(ctxAudio: AudioContext, seconds: number, style: string) {
  const dest = ctxAudio.createMediaStreamDestination();
  const master = ctxAudio.createGain();
  master.gain.value = 0.16;
  master.connect(dest);

  const energetic = /upbeat|energetic|electronic|pop/i.test(style);
  const roots = energetic ? [220, 277.18, 329.63, 261.63] : [174.61, 220, 261.63, 196];
  const beat = energetic ? 0.4 : 0.6;
  const now = ctxAudio.currentTime + 0.05;

  roots.forEach((freq, i) => {
    const osc = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    osc.type = energetic ? "triangle" : "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain).connect(master);
    for (let t = i * beat; t < seconds; t += beat * roots.length) {
      const at = now + t;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.5, at + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, at + beat * 1.6);
    }
    osc.start(now);
    osc.stop(now + seconds + 0.4);
  });

  // Soft kick pulse
  const kick = ctxAudio.createOscillator();
  const kickGain = ctxAudio.createGain();
  kick.type = "sine";
  kick.frequency.value = 70;
  kickGain.gain.value = 0;
  kick.connect(kickGain).connect(master);
  for (let t = 0; t < seconds; t += beat * 2) {
    const at = now + t;
    kickGain.gain.setValueAtTime(0, at);
    kickGain.gain.linearRampToValueAtTime(0.7, at + 0.01);
    kickGain.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
  }
  kick.start(now);
  kick.stop(now + seconds + 0.4);

  return dest;
}

export type RenderResult = { blob: Blob; mime: string; ext: string; duration: number };

/** Renders the full ad to a video Blob in the browser. */
export async function renderAdToBlob(opts: {
  plan: AdPlan;
  aspect: AspectRatio;
  withMusic?: boolean;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}): Promise<RenderResult> {
  const { plan, aspect, withMusic = true, onProgress } = opts;
  const { width, height } = dimensionsFor(aspect);
  const total = planTotal(plan);
  const images = await loadPlanImages(plan);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");

  const fps = 30;
  const stream = canvas.captureStream(fps);
  let audioCtx: AudioContext | undefined;
  if (withMusic && typeof AudioContext !== "undefined") {
    try {
      audioCtx = new AudioContext();
      const dest = buildMusicBed(audioCtx, total, plan.music_style);
      dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch {
      audioCtx = undefined;
    }
  }

  const mime = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(200);
  const started = performance.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - started) / 1000;
      if (opts.signal?.aborted) {
        resolve();
        return;
      }
      drawAdFrame(ctx, { plan, width, height, time: Math.min(elapsed, total), images });
      onProgress?.(Math.min(99, Math.round((elapsed / total) * 100)));
      if (elapsed >= total) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  await audioCtx?.close().catch(() => undefined);

  const outMime = mime.split(";")[0]!;
  const blob = new Blob(chunks, { type: outMime });
  onProgress?.(100);
  return { blob, mime: outMime, ext: outMime.includes("mp4") ? "mp4" : "webm", duration: total };
}
