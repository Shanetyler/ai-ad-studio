import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findStyle } from "./styles";

const Mode = z.enum(["prompt", "image", "url", "extend", "elements", "style"]);

const GenerateInput = z.object({
  brief: z.string().min(4).max(4000),
  brandId: z.string().uuid().optional(),
  duration: z.number().int().min(6).max(60).default(15),
  aspect: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  mode: Mode.default("prompt"),
  imageDataUrl: z.string().max(8_000_000).optional(), // data:image/...;base64,...
  sourceUrl: z.string().url().optional(),
  sourceProjectId: z.string().uuid().optional(),
  styleId: z.string().max(64).optional(),
  elements: z.array(z.string().max(200)).max(8).optional(),
});

type Scene = {
  index: number;
  duration_s: number;
  shot: string;
  visual: string;
  voiceover: string;
  on_screen_text?: string;
  image_url?: string;
};

type ScriptOut = {
  title: string;
  hook: string;
  voiceover: string;
  scenes: Scene[];
};

const SCRIPT_COST = 4;
const VISUAL_COST_PER_SCENE = 3;

type SupaCtx = { supabase: { rpc: (fn: "credit_balance", args: { _user_id: string }) => unknown } };
async function requireCredits(ctx: SupaCtx, userId: string, cost: number) {
  const res = (await (ctx.supabase.rpc("credit_balance", { _user_id: userId }) as Promise<{ data: number | null }>));
  if ((res.data ?? 0) < cost) throw new Error("Not enough credits. Top up to continue.");
}



export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireCredits(context.supabase, context.userId, SCRIPT_COST);

    // Brand context
    let brandCtx = "";
    if (data.brandId) {
      const { data: brand } = await context.supabase
        .from("brands")
        .select("name,tagline,tone,extracted_json")
        .eq("id", data.brandId)
        .maybeSingle();
      if (brand) brandCtx = `\nBrand: ${JSON.stringify(brand)}`;
    }

    // Mode-specific context
    let modeCtx = "";
    let referenceImageUrl: string | undefined;

    if (data.mode === "url" && data.sourceUrl) {
      try {
        const res = await fetch(data.sourceUrl, {
          headers: { "User-Agent": "EasyAdsBot/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        const html = await res.text();
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 6000);
        modeCtx = `\nSource URL: ${data.sourceUrl}\nPage excerpt:\n${text}`;
      } catch {
        modeCtx = `\nSource URL: ${data.sourceUrl} (could not fetch)`;
      }
    }

    if (data.mode === "image" && data.imageDataUrl) {
      referenceImageUrl = data.imageDataUrl;
      modeCtx = "\nAn attached reference image defines the look, subject, and framing of the first scene.";
    }

    if (data.mode === "extend" && data.sourceProjectId) {
      const { data: prev } = await context.supabase
        .from("scripts")
        .select("title,voiceover_text,beats_json")
        .eq("project_id", data.sourceProjectId)
        .maybeSingle();
      if (prev) {
        const beats = (prev.beats_json as unknown as Scene[]) ?? [];
        const last = beats[beats.length - 1];
        modeCtx = `\nExtend an existing spot titled "${prev.title}". Previous final scene: ${JSON.stringify(last)}. Continue the narrative seamlessly.`;
      }
    }

    if (data.mode === "elements" && data.elements?.length) {
      modeCtx = `\nInsert these elements into the storyboard as diegetic beats or on-screen text: ${data.elements.join(" | ")}.`;
    }

    let styleCtx = "";
    if (data.styleId) {
      const s = findStyle(data.styleId);
      if (s) styleCtx = `\nStyle direction (${s.name}): ${s.prompt}`;
    }

    // Create project
    const { data: project, error: projErr } = await context.supabase
      .from("projects")
      .insert({
        owner_id: context.userId,
        brand_id: data.brandId ?? null,
        title: data.brief.slice(0, 60) || "Untitled ad",
        brief: data.brief,
        status: "scripting",
      })
      .select()
      .single();
    if (projErr) throw new Error(projErr.message);

    const { data: job } = await context.supabase
      .from("jobs")
      .insert({
        owner_id: context.userId,
        project_id: project.id,
        kind: "script",
        status: "running",
        input_json: { ...data, imageDataUrl: data.imageDataUrl ? "[omitted]" : undefined } as unknown as never,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    try {
      const { aiJson, aiImage } = await import("./ai-gateway.server");
      const targetScenes = Math.max(3, Math.round(data.duration / 5));

      const script = await aiJson<ScriptOut>({
        system:
          "You are an award-winning commercial director and copywriter. Write a cinematic video ad script. Return strict JSON: { title, hook, voiceover, scenes: [{ index, duration_s, shot, visual, voiceover, on_screen_text }] }. Shot values: WIDE, MEDIUM, CLOSE_UP, MACRO, AERIAL. Keep total duration close to the target.",
        prompt: `Brief: ${data.brief}\nMode: ${data.mode}\nAspect ratio: ${data.aspect}\nTarget duration: ${data.duration}s across ~${targetScenes} scenes.${brandCtx}${modeCtx}${styleCtx}`,
      });

      // For image mode, generate + upload the reference image as project thumbnail
      let thumbnailUrl: string | null = null;
      if (data.mode === "image" && referenceImageUrl?.startsWith("data:")) {
        const m = referenceImageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (m) {
          const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
          const path = `${context.userId}/${project.id}/reference.png`;
          const { error: upErr } = await context.supabase.storage
            .from("project-assets")
            .upload(path, bytes, { contentType: m[1], upsert: true });
          if (!upErr) {
            const { data: signed } = await context.supabase.storage
              .from("project-assets")
              .createSignedUrl(path, 60 * 60 * 24 * 7);
            thumbnailUrl = signed?.signedUrl ?? null;
          }
        }
      }

      // Optional: hero frame for style mode
      if (data.mode === "style" && data.styleId) {
        try {
          const style = findStyle(data.styleId);
          const { base64, mime } = await aiImage({
            prompt: `${style?.prompt ?? ""}\nHero frame for this ad: ${script.hook}. Aspect ${data.aspect}. High detail, no text overlay.`,
          });
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const path = `${context.userId}/${project.id}/hero.png`;
          await context.supabase.storage
            .from("project-assets")
            .upload(path, bytes, { contentType: mime, upsert: true });
          const { data: signed } = await context.supabase.storage
            .from("project-assets")
            .createSignedUrl(path, 60 * 60 * 24 * 7);
          thumbnailUrl = signed?.signedUrl ?? thumbnailUrl;
        } catch {
          // non-fatal
        }
      }

      const { data: scriptRow } = await context.supabase
        .from("scripts")
        .insert({
          project_id: project.id,
          owner_id: context.userId,
          title: script.title,
          hook: script.hook,
          voiceover_text: script.voiceover,
          duration_s: data.duration,
          beats_json: script.scenes as unknown as never,
        })
        .select()
        .single();

      await context.supabase.from("storyboards").insert({
        project_id: project.id,
        owner_id: context.userId,
        scenes_json: script.scenes as unknown as never,
      });

      await context.supabase.from("credit_ledger").insert({
        user_id: context.userId,
        delta: -SCRIPT_COST,
        reason: `script_${data.mode}`,
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

      await context.supabase
        .from("projects")
        .update({
          status: "storyboard",
          thumbnail_url: thumbnailUrl,
        })
        .eq("id", project.id);

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

export const generateSceneVisuals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: sb } = await context.supabase
      .from("storyboards")
      .select("id,scenes_json")
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (!sb) throw new Error("Storyboard not found");
    const scenes = (sb.scenes_json as unknown as Scene[]) ?? [];
    if (!scenes.length) throw new Error("Storyboard is empty");

    const cost = scenes.length * VISUAL_COST_PER_SCENE;
    await requireCredits(context.supabase, context.userId, cost);

    const { data: project } = await context.supabase
      .from("projects")
      .select("brief,brand_id")
      .eq("id", data.projectId)
      .maybeSingle();

    let brandCtx = "";
    if (project?.brand_id) {
      const { data: brand } = await context.supabase
        .from("brands")
        .select("name,tone,primary_color,secondary_color")
        .eq("id", project.brand_id)
        .maybeSingle();
      if (brand) brandCtx = ` Brand palette: ${brand.primary_color ?? ""} ${brand.secondary_color ?? ""}. Tone: ${brand.tone ?? ""}.`;
    }

    const { aiImage } = await import("./ai-gateway.server");

    const updated: Scene[] = [];
    for (const scene of scenes) {
      try {
        const { base64, mime } = await aiImage({
          prompt: `${scene.shot} shot. ${scene.visual}. Cinematic, photoreal, high detail, no text overlay.${brandCtx}`,
        });
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const path = `${context.userId}/${data.projectId}/scene-${scene.index}.png`;
        const { error: upErr } = await context.supabase.storage
          .from("renders")
          .upload(path, bytes, { contentType: mime, upsert: true });
        if (upErr) throw upErr;
        const { data: signed } = await context.supabase.storage
          .from("renders")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        const image_url = signed?.signedUrl;

        await context.supabase.from("assets").insert({
          owner_id: context.userId,
          project_id: data.projectId,
          kind: "scene_image",
          storage_path: path,
          external_url: image_url ?? null,
          meta: { scene_index: scene.index } as unknown as never,
        });

        updated.push({ ...scene, image_url });
      } catch (e) {
        updated.push({ ...scene, image_url: undefined });
        console.error("scene image failed", scene.index, e);
      }
    }

    await context.supabase
      .from("storyboards")
      .update({ scenes_json: updated as unknown as never })
      .eq("id", sb.id);

    await context.supabase.from("credit_ledger").insert({
      user_id: context.userId,
      delta: -cost,
      reason: "scene_visuals",
    });

    const firstImage = updated.find((s) => s.image_url)?.image_url;
    if (firstImage) {
      await context.supabase
        .from("projects")
        .update({ thumbnail_url: firstImage, status: "visuals" })
        .eq("id", data.projectId);
    }

    return { scenes: updated };
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
