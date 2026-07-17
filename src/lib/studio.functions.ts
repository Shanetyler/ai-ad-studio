import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GenerateInput = z.object({
  brief: z.string().min(10).max(2000),
  brandId: z.string().uuid().optional(),
  duration: z.number().int().min(6).max(60).default(15),
  aspect: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
});

type Scene = {
  index: number;
  duration_s: number;
  shot: string;
  visual: string;
  voiceover: string;
  on_screen_text?: string;
};

type ScriptOut = {
  title: string;
  hook: string;
  voiceover: string;
  scenes: Scene[];
};

const SCRIPT_COST = 4;

export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    // Credit check
    const { data: bal } = await context.supabase.rpc("credit_balance", { _user_id: context.userId });
    if ((bal ?? 0) < SCRIPT_COST) {
      throw new Error("Not enough credits. Upgrade or top up to continue.");
    }

    // Optional brand context
    let brandCtx = "";
    if (data.brandId) {
      const { data: brand } = await context.supabase
        .from("brands")
        .select("name,tagline,tone,extracted_json")
        .eq("id", data.brandId)
        .maybeSingle();
      if (brand) brandCtx = `\nBrand: ${JSON.stringify(brand)}`;
    }

    // Create project
    const { data: project, error: projErr } = await context.supabase
      .from("projects")
      .insert({
        owner_id: context.userId,
        brand_id: data.brandId ?? null,
        title: data.brief.slice(0, 60),
        brief: data.brief,
        status: "scripting",
      })
      .select()
      .single();
    if (projErr) throw new Error(projErr.message);

    // Log job
    const { data: job } = await context.supabase
      .from("jobs")
      .insert({
        owner_id: context.userId,
        project_id: project.id,
        kind: "script",
        status: "running",
        input_json: data as unknown as Record<string, unknown>,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    try {
      const { aiJson } = await import("./ai-gateway.server");
      const targetScenes = Math.max(3, Math.round(data.duration / 5));
      const script = await aiJson<ScriptOut>({
        system:
          "You are an award-winning commercial director and copywriter. Write a cinematic video ad script. Return strict JSON: { title, hook, voiceover, scenes: [{ index, duration_s, shot, visual, voiceover, on_screen_text }] }. Shot values: WIDE, MEDIUM, CLOSE_UP, MACRO, AERIAL. Keep total duration close to the target.",
        prompt: `Brief: ${data.brief}\nAspect ratio: ${data.aspect}\nTarget duration: ${data.duration}s across ~${targetScenes} scenes.${brandCtx}`,
      });

      const { data: scriptRow } = await context.supabase
        .from("scripts")
        .insert({
          project_id: project.id,
          owner_id: context.userId,
          title: script.title,
          hook: script.hook,
          voiceover_text: script.voiceover,
          duration_s: data.duration,
          beats_json: script.scenes as unknown as Record<string, unknown>,
        })
        .select()
        .single();

      await context.supabase
        .from("storyboards")
        .insert({
          project_id: project.id,
          owner_id: context.userId,
          scenes_json: script.scenes as unknown as Record<string, unknown>,
        });

      // Debit credits
      await context.supabase.from("credit_ledger").insert({
        user_id: context.userId,
        delta: -SCRIPT_COST,
        reason: "script_generation",
        job_id: job?.id ?? null,
      });

      await context.supabase
        .from("jobs")
        .update({
          status: "succeeded",
          progress: 100,
          cost_credits: SCRIPT_COST,
          finished_at: new Date().toISOString(),
          output_json: { script_id: scriptRow?.id },
        })
        .eq("id", job!.id);

      await context.supabase.from("projects").update({ status: "storyboard" }).eq("id", project.id);

      return { projectId: project.id, script };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (job) {
        await context.supabase
          .from("jobs")
          .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
          .eq("id", job.id);
      }
      throw new Error(msg);
    }
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id,title,status,thumbnail_url,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("credit_balance", { _user_id: context.userId });
    return { credits: data ?? 0 };
  });

export const getProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: project }, { data: script }, { data: storyboard }] = await Promise.all([
      context.supabase.from("projects").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("scripts").select("*").eq("project_id", data.id).maybeSingle(),
      context.supabase.from("storyboards").select("*").eq("project_id", data.id).maybeSingle(),
    ]);
    if (!project) throw new Error("Project not found");
    return { project, script, storyboard };
  });
