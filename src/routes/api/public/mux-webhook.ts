import { createFileRoute } from "@tanstack/react-router";

// Verifies Mux webhook signature (Mux-Signature: t=..,v1=..) and updates the matching project.
async function verifyMuxSignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((s) => {
      const [k, v] = s.split("=");
      return [k.trim(), v?.trim() ?? ""];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const payload = `${t}.${rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // constant-time compare
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/mux-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret = process.env.MUX_WEBHOOK_SECRET;
        if (secret) {
          const ok = await verifyMuxSignature(raw, request.headers.get("mux-signature"), secret);
          if (!ok) return new Response("invalid signature", { status: 401 });
        }

        const evt = JSON.parse(raw) as {
          type: string;
          data: {
            id: string;
            playback_ids?: Array<{ id: string; policy: string }>;
            duration?: number;
            passthrough?: string;
          };
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const projectId = evt.data.passthrough;
        if (!projectId) return new Response("ok");

        if (evt.type === "video.asset.ready") {
          const playbackId =
            evt.data.playback_ids?.find((p) => p.policy === "public")?.id ?? null;
          await supabaseAdmin
            .from("projects")
            .update({
              video_status: "ready",
              status: "ready",
              mux_playback_id: playbackId,
              duration_seconds: evt.data.duration ?? null,
              thumbnail_url: playbackId
                ? `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`
                : null,
            })
            .eq("id", projectId);

          await supabaseAdmin
            .from("jobs")
            .update({ status: "succeeded", finished_at: new Date().toISOString(), progress: 100 })
            .eq("project_id", projectId)
            .eq("kind", "video")
            .eq("status", "running");
        } else if (evt.type === "video.asset.errored") {
          await supabaseAdmin
            .from("projects")
            .update({ video_status: "error", render_error: "Mux processing failed" })
            .eq("id", projectId);
        }

        return new Response("ok");
      },
    },
  },
});
