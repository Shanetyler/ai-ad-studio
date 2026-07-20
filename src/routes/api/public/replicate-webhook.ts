import { createFileRoute } from "@tanstack/react-router";

// Replicate calls this URL when a video prediction completes.
// We download the MP4, upload it to Supabase Storage, then create a Mux asset from a signed URL.
export const Route = createFileRoute("/api/public/replicate-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const projectId = url.searchParams.get("project");
        const jobId = url.searchParams.get("job");
        if (!projectId || !jobId) return new Response("missing params", { status: 400 });

        const payload = (await request.json().catch(() => null)) as
          | { id?: string; status?: string; output?: string | string[]; error?: string | null }
          | null;
        if (!payload) return new Response("bad payload", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Verify job/project link (basic guard against forged callbacks)
        const { data: job } = await supabaseAdmin
          .from("jobs")
          .select("id, owner_id, project_id, cost_credits, output_json")
          .eq("id", jobId)
          .maybeSingle();
        if (!job || job.project_id !== projectId) return new Response("not found", { status: 404 });

        if (payload.status !== "succeeded" || !payload.output) {
          const errMsg = payload.error || `Generation ${payload.status}`;
          await supabaseAdmin
            .from("projects")
            .update({ video_status: "error", render_error: errMsg.slice(0, 500) })
            .eq("id", projectId);
          await supabaseAdmin
            .from("jobs")
            .update({ status: "failed", error: errMsg.slice(0, 500), finished_at: new Date().toISOString() })
            .eq("id", jobId);
          // Refund credits via admin (service_role bypasses the RPC's auth.uid() check, so insert directly)
          if (job.cost_credits > 0) {
            await supabaseAdmin.from("credit_ledger").insert({
              user_id: job.owner_id,
              delta: job.cost_credits,
              reason: "video_render_failed",
              job_id: job.id,
            });
          }
          return new Response("ok");
        }

        const videoUrl = Array.isArray(payload.output) ? payload.output[0] : payload.output;
        if (!videoUrl) return new Response("no output", { status: 400 });

        // Download the generated video
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) {
          await supabaseAdmin
            .from("projects")
            .update({ video_status: "error", render_error: "Failed to download video" })
            .eq("id", projectId);
          return new Response("download failed", { status: 500 });
        }
        const videoBuf = new Uint8Array(await videoRes.arrayBuffer());

        // Upload to Supabase storage under <userId>/<projectId>.mp4
        const path = `${job.owner_id}/${projectId}-${Date.now()}.mp4`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("ad-videos")
          .upload(path, videoBuf, { contentType: "video/mp4", upsert: true });
        if (upErr) {
          await supabaseAdmin
            .from("projects")
            .update({ video_status: "error", render_error: `Storage: ${upErr.message}` })
            .eq("id", projectId);
          return new Response("storage failed", { status: 500 });
        }

        // Create signed URL that Mux can ingest from
        const { data: signed } = await supabaseAdmin.storage
          .from("ad-videos")
          .createSignedUrl(path, 60 * 60);

        if (!signed?.signedUrl) {
          await supabaseAdmin
            .from("projects")
            .update({ video_status: "error", render_error: "Sign URL failed" })
            .eq("id", projectId);
          return new Response("sign failed", { status: 500 });
        }

        await supabaseAdmin
          .from("projects")
          .update({ video_status: "uploading", supabase_video_path: path })
          .eq("id", projectId);

        // Create Mux asset from URL
        const muxId = process.env.MUX_TOKEN_ID;
        const muxSecret = process.env.MUX_TOKEN_SECRET;
        if (!muxId || !muxSecret) return new Response("mux not configured", { status: 500 });
        const basic = btoa(`${muxId}:${muxSecret}`);

        const muxRes = await fetch("https://api.mux.com/video/v1/assets", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: [{ url: signed.signedUrl }],
            playback_policy: ["public"],
            video_quality: "basic",
            passthrough: projectId,
          }),
        });
        if (!muxRes.ok) {
          const t = await muxRes.text().catch(() => "");
          await supabaseAdmin
            .from("projects")
            .update({ video_status: "error", render_error: `Mux: ${t.slice(0, 200)}` })
            .eq("id", projectId);
          return new Response("mux failed", { status: 500 });
        }
        const muxData = (await muxRes.json()) as {
          data: { id: string; playback_ids?: Array<{ id: string; policy: string }> };
        };

        const playbackId = muxData.data.playback_ids?.find((p) => p.policy === "public")?.id;

        await supabaseAdmin
          .from("projects")
          .update({
            video_status: "processing",
            mux_asset_id: muxData.data.id,
            mux_playback_id: playbackId ?? null,
            thumbnail_url: playbackId
              ? `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`
              : null,
          })
          .eq("id", projectId);

        await supabaseAdmin
          .from("jobs")
          .update({
            status: "running",
            output_json: { ...(job.output_json as object), mux_asset_id: muxData.data.id },
          })
          .eq("id", jobId);

        return new Response("ok");
      },
    },
  },
});
