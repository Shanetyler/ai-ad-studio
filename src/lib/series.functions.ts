import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findStyle } from "./styles";

const SERIES_SCRIPT_COST = 2; // per episode, matches solo ad script cost

const CreateInput = z.object({
  title: z.string().min(2).max(120),
  brief: z.string().min(10).max(4000),
  length: z.union([z.literal(3), z.literal(7), z.literal(10)]),
  aspect: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  brandId: z.string().uuid().optional(),
  timelineType: z.enum(["campaign", "countdown", "launch"]).default("campaign"),
  duration: z.number().int().min(6).max(60).default(15),
  styleId: z.string().max(64).optional(),
  continuity: z.object({
    character: z.string().max(400).optional(),
    style: z.string().max(400).optional(),
    voice: z.string().max(200).optional(),
    offer: z.string().max(400).optional(),
    deadline: z.string().max(200).optional(),
    keepCharacter: z.boolean().default(true),
    keepStyle: z.boolean().default(true),
    keepVoice: z.boolean().default(true),
    keepOffer: z.boolean().default(true),
    keepDeadline: z.boolean().default(true),
  }),
});

type EpisodePlan = {
  index: number;
  title: string;
  phase: string;
  hook: string;
  brief: string;
};

type ScriptOut = {
  title: string;
  hook: string;
  voiceover: string;
  scenes: Array<{
    index: number;
    duration_s: number;
    shot: string;
    visual: string;
    voiceover: string;
    on_screen_text?: string;
  }>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function consume(ctx: any, userId: string, amount: number, reason: string, jobId?: string | null) {
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

async function refund(ctx: any, userId: string, amount: number, reason: string, jobId?: string | null) {
  await ctx.supabase.rpc("refund_credits", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _job_id: jobId ?? null,
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const createSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const totalCost = SERIES_SCRIPT_COST * data.length;

    // Brand context
    let brandCtx = "";
    if (data.brandId) {
      const { data: brand } = await supabase
        .from("brands")
        .select("name,tagline,tone,extracted_json")
        .eq("id", data.brandId)
        .maybeSingle();
      if (brand) brandCtx = `\nBrand: ${JSON.stringify(brand)}`;
    }

    const styleCtx = data.styleId ? `\nStyle: ${findStyle(data.styleId)?.prompt ?? ""}` : "";
    const cont = data.continuity;
    const continuityCtx = `
Continuity across episodes:
- Character/spokesperson (${cont.keepCharacter ? "KEEP consistent" : "may vary"}): ${cont.character ?? "n/a"}
- Visual style/branding (${cont.keepStyle ? "KEEP consistent" : "may vary"}): ${cont.style ?? "n/a"}
- Voiceover/narrator (${cont.keepVoice ? "KEEP consistent" : "may vary"}): ${cont.voice ?? "n/a"}
- Promotional offer (${cont.keepOffer ? "KEEP consistent" : "may vary"}): ${cont.offer ?? "n/a"}
- Time-sensitive deadline (${cont.keepDeadline ? "KEEP consistent" : "may vary"}): ${cont.deadline ?? "n/a"}
Timeline type: ${data.timelineType}
`;

    // Create the series row first
    const { data: seriesRow, error: sErr } = await supabase
      .from("series")
      .insert({
        owner_id: userId,
        brand_id: data.brandId ?? null,
        title: data.title,
        brief: data.brief,
        length: data.length,
        aspect_ratio: data.aspect,
        timeline_type: data.timelineType,
        continuity_json: cont as unknown as never,
        status: "scripting",
      })
      .select()
      .single();
    if (sErr || !seriesRow) throw new Error(sErr?.message ?? "Failed to create series");

    // Deduct all script credits up front
    await consume(context, userId, totalCost, "series_scripts", null);

    try {
      const { aiJson } = await import("./ai-gateway.server");

      // 1) Plan the full series arc first (single AI call for continuity)
      const plan = await aiJson<{ episodes: EpisodePlan[] }>({
        system:
          "You are an award-winning campaign director. Plan a connected ad video series that reads like sequential episodes with a clear start-to-finish arc. Return strict JSON: { episodes: [{ index, title, phase, hook, brief }] }. Each episode must advance the timeline meaningfully (e.g., Day 1 intro -> Day 3 urgency -> final call). Keep continuity as instructed.",
        prompt: `Series brief: ${data.brief}
Number of episodes: ${data.length}
Timeline type: ${data.timelineType}
${brandCtx}${styleCtx}${continuityCtx}
Generate exactly ${data.length} episode plans in order.`,
      });

      const episodes = (plan.episodes ?? []).slice(0, data.length);
      if (episodes.length < data.length) {
        throw new Error("Series planner returned an incomplete plan");
      }

      // 2) Generate a full script for each episode (sequentially so we can pass previous ending as continuity)
      const createdProjects: Array<{ id: string; index: number; title: string }> = [];
      let previousEnding = "";

      for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];

        const { data: project, error: pErr } = await supabase
          .from("projects")
          .insert({
            owner_id: userId,
            brand_id: data.brandId ?? null,
            series_id: seriesRow.id,
            series_index: i,
            title: `E${i + 1}: ${ep.title}`,
            brief: ep.brief,
            status: "scripting",
            aspect_ratio: data.aspect,
          })
          .select()
          .single();
        if (pErr || !project) throw new Error(pErr?.message ?? "project insert failed");

        const targetScenes = Math.max(3, Math.round(data.duration / 5));
        const script = await aiJson<ScriptOut>({
          system:
            "You are an award-winning commercial director. Write ONE episode of a connected ad series. Return strict JSON: { title, hook, voiceover, scenes: [{ index, duration_s, shot, visual, voiceover, on_screen_text }] }. Shot values: WIDE, MEDIUM, CLOSE_UP, MACRO, AERIAL. This episode must feel like a chapter — pick up where the previous ended and lead naturally into the next.",
          prompt: `Series brief: ${data.brief}
Episode ${i + 1} of ${data.length} — Phase: ${ep.phase}
Episode hook: ${ep.hook}
Episode brief: ${ep.brief}
Target duration: ${data.duration}s across ~${targetScenes} scenes.
Aspect ratio: ${data.aspect}
${previousEnding ? `Previous episode ended with: ${previousEnding}` : "This is the first episode."}
${brandCtx}${styleCtx}${continuityCtx}`,
        });

        await supabase.from("scripts").insert({
          project_id: project.id,
          owner_id: userId,
          title: script.title,
          hook: script.hook,
          voiceover_text: script.voiceover,
          duration_s: data.duration,
          beats_json: script.scenes as unknown as never,
        });

        await supabase.from("storyboards").insert({
          project_id: project.id,
          owner_id: userId,
          scenes_json: script.scenes as unknown as never,
        });

        await supabase.from("projects").update({ status: "storyboard" }).eq("id", project.id);

        const lastScene = script.scenes[script.scenes.length - 1];
        previousEnding = lastScene ? `${lastScene.visual} — VO: ${lastScene.voiceover}` : script.hook;
        createdProjects.push({ id: project.id, index: i, title: script.title });
      }

      await supabase.from("series").update({ status: "ready" }).eq("id", seriesRow.id);

      return { seriesId: seriesRow.id, projects: createdProjects };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Series generation failed";
      try {
        await refund(context, userId, totalCost, "series_scripts_refund", null);
      } catch (rErr) {
        console.error("series refund failed", rErr);
      }
      await supabase.from("series").update({ status: "error" }).eq("id", seriesRow.id);
      throw new Error(msg);
    }
  });

export const listSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("series")
      .select("id,title,length,status,timeline_type,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: series }, { data: projects }] = await Promise.all([
      context.supabase.from("series").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("projects")
        .select("id,title,series_index,status,thumbnail_url,video_status")
        .eq("series_id", data.id)
        .order("series_index", { ascending: true }),
    ]);
    if (!series) throw new Error("Series not found");
    return { series, projects: projects ?? [] };
  });
