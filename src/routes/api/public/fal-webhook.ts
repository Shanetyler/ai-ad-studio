import { createFileRoute } from "@tanstack/react-router";

// fal.ai webhook — receives completion of a Kling video render, downloads the MP4,
// stores it in the ad-videos Supabase bucket, and marks the project ready.

type FalPayload = {
  request_id: string;
  gateway_request_id?: string;
  status: "OK" | "ERROR";
  error?: string;
  payload_error?: string;
  payload?: {
    video?: { url?: string; file_name?: string; content_type?: string };
  };
};

export const Route = createFileRoute("/api/public/fal-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const projectId = url.searchParams.get("project");
        const jobId = url.searchParams.get("job");
        if (!projectId) return new Response("missing project", { status: 400 });

        const evt = (await request.json()) as FalPayload;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Load project to find owner (for storage path scoping)
        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("owner_id")
          .eq("id", projectId)
          .maybeSingle();
        if (!project) return new Response("project not found", { status: 404 });

        const failRender = async (msg: string) => {
          await supabaseAdmin
            .from("projects")
            .update({ video_status: "error", render_error: msg.slice(0, 500) })
            .eq("id", projectId);
          if (jobId) {
            await supabaseAdmin
              .from("jobs")
              .update({
                status: "failed",
                error: msg.slice(0, 500),
                finished_at: new Date().toISOString(),
              })
              .eq("id", jobId);
          }
        };

        if (evt.status === "ERROR" || !evt.payload?.video?.url) {
          await failRender(evt.error || evt.payload_error || "Render failed");
          return new Response("ok");
        }

        try {
          await supabaseAdmin
            .from("projects")
            .update({ video_status: "uploading" })
            .eq("id", projectId);

          // Download the finished MP4 from fal's CDN
          const videoRes = await fetch(evt.payload.video.url);
          if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`);
          const bytes = new Uint8Array(await videoRes.arrayBuffer());

          const path = `${project.owner_id}/${projectId}.mp4`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("ad-videos")
            .upload(path, bytes, {
              contentType: "video/mp4",
              upsert: true,
            });
          if (upErr) throw new Error(upErr.message);

          await supabaseAdmin
            .from("projects")
            .update({
              video_status: "ready",
              status: "ready",
              supabase_video_path: path,
              render_error: null,
            })
            .eq("id", projectId);

          if (jobId) {
            await supabaseAdmin
              .from("jobs")
              .update({
                status: "succeeded",
                progress: 100,
                finished_at: new Date().toISOString(),
              })
              .eq("id", jobId);
          }

          return new Response("ok");
        } catch (e) {
          await failRender(e instanceof Error ? e.message : "Upload failed");
          return new Response("ok");
        }
      },
    },
  },
});
