import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RENDER_COST_PER_SECOND = 2; // credits

const StartInput = z.object({ projectId: z.string().uuid() });
const SignedUrlInput = z.object({ projectId: z.string().uuid() });

type Scene = {
  index: number;
  duration_s: number;
  shot: string;
  visual: string;
  voiceover: string;
  image_url?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

async function consume(ctx: any, userId: string, amount: number, reason: string, jobId?: string) {
  const { error } = await ctx.supabase.rpc("consume_credits", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _job_id: jobId ?? null,
  });
  if (error) {
    if (error.message.includes("INSUFFICIENT_CREDITS")) {
      throw new Error("Not enough credits. Top up to continue.");
    }
    throw new Error(error.message);
  }
}

async function refund(ctx: any, userId: string, amount: number, reason: string, jobId?: string) {
  await ctx.supabase.rpc("refund_credits", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _job_id: jobId ?? null,
  });
}

/**
 * Start a video render for a project via fal.ai (Kling v2 master).
 * The fal webhook (/api/public/fal-webhook) handles completion:
 * downloading the MP4 and uploading it to Supabase Storage.
 */
export const startVideoRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, owner_id, title, video_status, brand_id, aspect_ratio")
      .eq("id", data.projectId)
      .single();
    if (pErr || !project) throw new Error("Project not found");
    if (project.owner_id !== userId) throw new Error("Not authorized");
    if (["generating", "uploading", "processing"].includes(project.video_status)) {
      throw new Error("A render is already in progress");
    }

    const { data: storyboard } = await supabase
      .from("storyboards")
      .select("scenes_json")
      .eq("project_id", data.projectId)
      .maybeSingle();

    const scenes = (storyboard?.scenes_json as Scene[] | null) ?? [];
    if (!scenes.length) throw new Error("Generate the storyboard first");

    const { data: script } = await supabase
      .from("scripts")
      .select("hook, voiceover_text")
      .eq("project_id", data.projectId)
      .maybeSingle();

    let brand: { name: string | null; tone: string | null } | null = null;
    if (project.brand_id) {
      const { data: b } = await supabase
        .from("brands")
        .select("name, tone")
        .eq("id", project.brand_id)
        .maybeSingle<{ name: string | null; tone: string | null }>();
      brand = b;
    }

    const totalDur = scenes.reduce((s, x) => s + (x.duration_s || 3), 0);
    const duration = Math.min(10, Math.max(5, totalDur));
    const cost = duration * RENDER_COST_PER_SECOND;

    const { data: job, error: jErr } = await supabase
      .from("jobs")
      .insert({
        owner_id: userId,
        project_id: data.projectId,
        kind: "video",
        status: "queued",
        cost_credits: cost,
        model_id: "fal-ai/kling-video/v2/master",
        input_json: { duration, aspect: project.aspect_ratio, scenes: scenes.length },
      })
      .select("id")
      .single();
    if (jErr) throw new Error(jErr.message);

    await consume(context, userId, cost, "video", job.id);

    const scenePrompt = scenes
      .slice(0, 6)
      .map((s, i) => `Scene ${i + 1} (${s.shot}): ${s.visual}`)
      .join(". ");
    const brandLine = brand?.name
      ? `Brand: ${brand.name}. Tone: ${brand.tone ?? "confident, cinematic"}.`
      : "";
    const prompt =
      `${brandLine} ${script?.hook ? `Hook: ${script.hook}.` : ""} ${scenePrompt}. ` +
      `Cinematic, high-contrast, shallow depth of field, smooth camera motion, ad-quality.`;

    const referenceImage = scenes.find((s) => s.image_url)?.image_url;

    const falKey = process.env.FAL_KEY;
    const appUrl = process.env.PUBLIC_APP_URL;
    if (!falKey) throw new Error("FAL_KEY missing");
    if (!appUrl) throw new Error("PUBLIC_APP_URL missing");

    const modelDuration = duration <= 5 ? "5" : "10";
    const aspectMap: Record<string, string> = { "16:9": "16:9", "9:16": "9:16", "1:1": "1:1" };
    const aspect = aspectMap[project.aspect_ratio] ?? "16:9";

    const modelPath = referenceImage
      ? "fal-ai/kling-video/v2/master/image-to-video"
      : "fal-ai/kling-video/v2/master/text-to-video";

    const input: Record<string, unknown> = {
      prompt: prompt.slice(0, 2400),
      duration: modelDuration,
      aspect_ratio: aspect,
      negative_prompt: "blurry, low quality, watermark, text artifacts, distorted",
    };
    if (referenceImage) input.image_url = referenceImage;

    const webhookUrl =
      `${appUrl}/api/public/fal-webhook?project=${data.projectId}&job=${job.id}`;

    const res = await fetch(
      `https://queue.fal.run/${modelPath}?fal_webhook=${encodeURIComponent(webhookUrl)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      await refund(context, userId, cost, "video_render_failed", job.id);
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error: errText.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      throw new Error(`Video generation failed to start: ${res.status}`);
    }

    const prediction = (await res.json()) as { request_id: string };

    await supabase
      .from("projects")
      .update({
        video_status: "generating",
        generated_model: "kling-v2-master",
        credits_used: cost,
        render_error: null,
      })
      .eq("id", data.projectId);

    await supabase
      .from("jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        output_json: { fal_request_id: prediction.request_id, model_path: modelPath },
      })
      .eq("id", job.id);

    return { ok: true, jobId: job.id, requestId: prediction.request_id };
  });

/** Returns a short-lived signed URL for the rendered video in Supabase Storage. */
export const getVideoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SignedUrlInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("owner_id, supabase_video_path")
      .eq("id", data.projectId)
      .single();
    if (error || !project) throw new Error("Project not found");
    if (project.owner_id !== userId) throw new Error("Not authorized");
    if (!project.supabase_video_path) return { url: null };

    const { data: signed, error: sErr } = await supabase.storage
      .from("ad-videos")
      .createSignedUrl(project.supabase_video_path, 60 * 60);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });
