import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RENDER_COST_PER_SECOND = 2; // credits

const StartInput = z.object({ projectId: z.string().uuid() });

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
 * Start a video render for a project. Uses Replicate's Kling v2.1 model.
 * The Replicate webhook (/api/public/replicate-webhook) handles completion:
 * downloading the MP4, uploading it to Supabase Storage, and creating a Mux asset.
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

    let brand: { name?: string; tone?: string; hooks?: string[] } | null = null;
    if (project.brand_id) {
      const { data: b } = await supabase
        .from("brands")
        .select("name, tone, hooks")
        .eq("id", project.brand_id)
        .maybeSingle();
      brand = b as typeof brand;
    }

    const duration = Math.min(
      30,
      Math.max(5, scenes.reduce((s, x) => s + (x.duration_s || 3), 0)),
    );
    const cost = duration * RENDER_COST_PER_SECOND;

    // Create tracking job first
    const { data: job, error: jErr } = await supabase
      .from("jobs")
      .insert({
        owner_id: userId,
        project_id: data.projectId,
        kind: "video_render",
        status: "queued",
        cost_credits: cost,
        model_id: "kwaivgi/kling-v2.1",
        input_json: { duration, aspect: project.aspect_ratio, scenes: scenes.length },
      })
      .select("id")
      .single();
    if (jErr) throw new Error(jErr.message);

    await consume(context, userId, cost, "video_render", job.id);

    // Build a cinematic prompt combining scenes + brand
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

    // Kick off Replicate prediction with webhook
    const replicateKey = process.env.REPLICATE_API_TOKEN;
    const appUrl = process.env.PUBLIC_APP_URL;
    if (!replicateKey) throw new Error("REPLICATE_API_TOKEN missing");
    if (!appUrl) throw new Error("PUBLIC_APP_URL missing");

    const webhookUrl = `${appUrl}/api/public/replicate-webhook?project=${data.projectId}&job=${job.id}`;

    const modelDuration = duration <= 5 ? 5 : 10; // kling supports 5 or 10
    const aspectMap: Record<string, string> = { "16:9": "16:9", "9:16": "9:16", "1:1": "1:1" };
    const aspect = aspectMap[project.aspect_ratio] ?? "16:9";

    const body: Record<string, unknown> = {
      input: {
        prompt: prompt.slice(0, 2400),
        duration: modelDuration,
        aspect_ratio: aspect,
        negative_prompt: "blurry, low quality, watermark, text artifacts, distorted",
      },
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    };
    if (referenceImage) (body.input as Record<string, unknown>).start_image = referenceImage;

    const res = await fetch("https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateKey}`,
        "Content-Type": "application/json",
        Prefer: "wait=0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      await refund(context, userId, cost, "video_render_failed", job.id);
      await supabase
        .from("jobs")
        .update({ status: "failed", error: errText.slice(0, 500), finished_at: new Date().toISOString() })
        .eq("id", job.id);
      throw new Error(`Video generation failed to start: ${res.status}`);
    }

    const prediction = (await res.json()) as { id: string };

    await supabase
      .from("projects")
      .update({
        video_status: "generating",
        generated_model: "kling-v2.1",
        credits_used: cost,
        render_error: null,
      })
      .eq("id", data.projectId);

    await supabase
      .from("jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        output_json: { replicate_id: prediction.id },
      })
      .eq("id", job.id);

    return { ok: true, jobId: job.id, predictionId: prediction.id };
  });
