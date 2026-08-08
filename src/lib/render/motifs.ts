// Vector motion-graphic motifs drawn entirely by us — no third-party media.

import type { MotifId } from "@/lib/media-library";

type Ctx = CanvasRenderingContext2D;
type Args = { w: number; h: number; t: number; color: string; accent: string };

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function drawMotif(ctx: Ctx, motif: MotifId, a: Args) {
  const { w, h, t, color, accent } = a;
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.012;
  ctx.lineCap = "round";

  switch (motif) {
    case "lawn": {
      for (let i = 0; i < 26; i++) {
        const x = (i / 25) * w;
        const sway = Math.sin(t * 1.8 + i * 0.5) * s * 0.03;
        const bh = s * (0.18 + 0.1 * ((i * 37) % 10) / 10);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.92);
        ctx.quadraticCurveTo(x + sway, h * 0.92 - bh * 0.6, x + sway * 1.6, h * 0.92 - bh);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = accent;
      roundRect(ctx, -w * 0.1 + ((t * 60) % (w * 1.3)), h * 0.86, w * 0.18, s * 0.05, s * 0.02);
      break;
    }
    case "leaf": {
      for (let i = 0; i < 7; i++) {
        const ang = t * 0.5 + (i / 7) * Math.PI * 2;
        const r = s * (0.18 + 0.06 * Math.sin(t + i));
        ctx.save();
        ctx.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.09, s * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "house":
    case "keys": {
      const bob = Math.sin(t * 1.6) * s * 0.015;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.22 + bob);
      ctx.lineTo(cx + s * 0.26, cy + bob);
      ctx.lineTo(cx - s * 0.26, cy + bob);
      ctx.closePath();
      ctx.fill();
      roundRect(ctx, cx - s * 0.19, cy + bob, s * 0.38, s * 0.22, s * 0.02);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = accent;
      roundRect(ctx, cx - s * 0.05, cy + bob + s * 0.08, s * 0.1, s * 0.14, s * 0.01);
      if (motif === "keys") {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = color;
        const ky = cy + s * 0.3 + Math.sin(t * 2) * s * 0.02;
        circle(ctx, cx - s * 0.14, ky, s * 0.035);
        roundRect(ctx, cx - s * 0.13, ky - s * 0.012, s * 0.22, s * 0.024, s * 0.012);
      }
      break;
    }
    case "blueprint": {
      ctx.globalAlpha = 0.35;
      const step = s * 0.08;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = accent;
      ctx.lineWidth = s * 0.02;
      const p = Math.min(1, (t % 4) / 3);
      ctx.beginPath();
      ctx.rect(cx - s * 0.24, cy - s * 0.16, s * 0.48 * p, s * 0.32);
      ctx.stroke();
      break;
    }
    case "bubbles": {
      for (let i = 0; i < 16; i++) {
        const seed = ((i * 97) % 100) / 100;
        const y = h - (((t * (0.12 + seed * 0.2) + seed) % 1) * h * 1.1);
        const x = seed * w + Math.sin(t + i) * s * 0.03;
        ctx.globalAlpha = 0.25 + seed * 0.4;
        circle(ctx, x, y, s * (0.02 + seed * 0.045));
      }
      break;
    }
    case "sparkle": {
      for (let i = 0; i < 10; i++) {
        const seed = ((i * 61) % 100) / 100;
        const ph = (t * 0.8 + seed) % 1;
        const r = s * 0.07 * Math.sin(ph * Math.PI);
        const x = seed * w;
        const y = ((seed * 7) % 1) * h;
        ctx.globalAlpha = Math.sin(ph * Math.PI);
        ctx.fillStyle = i % 2 ? accent : color;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.3, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.3, y);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "plate": {
      ctx.globalAlpha = 0.9;
      circle(ctx, cx, cy, s * 0.26 + Math.sin(t * 1.4) * s * 0.006);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.55;
      circle(ctx, cx, cy, s * 0.17);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        const ang = t * 0.6 + (i / 5) * Math.PI * 2;
        circle(ctx, cx + Math.cos(ang) * s * 0.1, cy + Math.sin(ang) * s * 0.1, s * 0.03);
      }
      break;
    }
    case "coffee": {
      roundRect(ctx, cx - s * 0.15, cy - s * 0.08, s * 0.3, s * 0.24, s * 0.03);
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.arc(cx + s * 0.19, cy + s * 0.04, s * 0.06, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = accent;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const ox = cx - s * 0.07 + i * s * 0.07;
        ctx.moveTo(ox, cy - s * 0.12);
        ctx.quadraticCurveTo(ox + Math.sin(t * 2 + i) * s * 0.04, cy - s * 0.2, ox, cy - s * 0.28);
        ctx.stroke();
      }
      break;
    }
    case "car": {
      const x = cx + Math.sin(t * 0.8) * s * 0.05;
      roundRect(ctx, x - s * 0.26, cy - s * 0.02, s * 0.52, s * 0.14, s * 0.04);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.16, cy - s * 0.02);
      ctx.quadraticCurveTo(x - s * 0.06, cy - s * 0.18, x + s * 0.1, cy - s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      circle(ctx, x - s * 0.14, cy + s * 0.13, s * 0.05);
      circle(ctx, x + s * 0.16, cy + s * 0.13, s * 0.05);
      break;
    }
    case "road": {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.05, cy - s * 0.3);
      ctx.lineTo(cx + s * 0.05, cy - s * 0.3);
      ctx.lineTo(cx + s * 0.45, h);
      ctx.lineTo(cx - s * 0.45, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      for (let i = 0; i < 6; i++) {
        const p = ((t * 0.5 + i / 6) % 1);
        const y = cy - s * 0.3 + p * (h - cy + s * 0.3);
        const wd = s * 0.012 + p * s * 0.03;
        roundRect(ctx, cx - wd / 2, y, wd, s * 0.05 + p * s * 0.06, wd / 2);
      }
      break;
    }
    case "dumbbell": {
      const pulse = 1 + Math.sin(t * 3) * 0.05;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      roundRect(ctx, -s * 0.2, -s * 0.03, s * 0.4, s * 0.06, s * 0.03);
      roundRect(ctx, -s * 0.28, -s * 0.1, s * 0.08, s * 0.2, s * 0.02);
      roundRect(ctx, s * 0.2, -s * 0.1, s * 0.08, s * 0.2, s * 0.02);
      ctx.restore();
      break;
    }
    case "pulse": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = s * 0.016;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const k = x / w;
        const y = cy + Math.sin(k * 12 + t * 4) * s * 0.12 * Math.exp(-Math.pow((k - ((t * 0.3) % 1)) * 3, 2));
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case "scissors": {
      ctx.save();
      ctx.translate(cx, cy);
      const open = Math.sin(t * 2) * 0.25;
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.rotate(dir * (0.35 + open));
        ctx.lineWidth = s * 0.02;
        ctx.beginPath();
        ctx.moveTo(-s * 0.02, 0);
        ctx.lineTo(s * 0.26, 0);
        ctx.stroke();
        ctx.fillStyle = accent;
        circle(ctx, -s * 0.1, 0, s * 0.05);
        ctx.restore();
      }
      ctx.restore();
      break;
    }
    case "bag": {
      const bob = Math.sin(t * 1.6) * s * 0.02;
      roundRect(ctx, cx - s * 0.17, cy - s * 0.1 + bob, s * 0.34, s * 0.3, s * 0.03);
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.1 + bob, s * 0.09, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case "tag": {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 1.5) * 0.12 - 0.2);
      roundRect(ctx, -s * 0.2, -s * 0.12, s * 0.4, s * 0.24, s * 0.04);
      ctx.fillStyle = accent;
      circle(ctx, -s * 0.13, 0, s * 0.035);
      ctx.restore();
      break;
    }
    case "wrench": {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 2) * 0.4);
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, s * 0.18);
      ctx.lineTo(s * 0.12, -s * 0.12);
      ctx.stroke();
      ctx.fillStyle = accent;
      circle(ctx, s * 0.17, -s * 0.17, s * 0.08);
      ctx.globalCompositeOperation = "destination-out";
      circle(ctx, s * 0.2, -s * 0.2, s * 0.04);
      ctx.restore();
      break;
    }
    case "briefcase": {
      roundRect(ctx, cx - s * 0.2, cy - s * 0.08, s * 0.4, s * 0.26, s * 0.03);
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.06, cy - s * 0.08);
      ctx.lineTo(cx - s * 0.06, cy - s * 0.16);
      ctx.lineTo(cx + s * 0.06, cy - s * 0.16);
      ctx.lineTo(cx + s * 0.06, cy - s * 0.08);
      ctx.stroke();
      ctx.fillStyle = accent;
      roundRect(ctx, cx - s * 0.2, cy + s * 0.02 + Math.sin(t * 2) * s * 0.005, s * 0.4, s * 0.03, s * 0.01);
      break;
    }
    case "chart": {
      const bars = 5;
      for (let i = 0; i < bars; i++) {
        const p = Math.min(1, Math.max(0, t * 0.6 - i * 0.15));
        const bh = s * (0.08 + i * 0.05) * p;
        ctx.fillStyle = i === bars - 1 ? accent : color;
        roundRect(ctx, cx - s * 0.26 + i * s * 0.11, cy + s * 0.18 - bh, s * 0.07, bh, s * 0.015);
      }
      break;
    }
  }
  ctx.restore();
}
