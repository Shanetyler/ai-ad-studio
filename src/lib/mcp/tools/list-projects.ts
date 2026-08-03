import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List ad projects",
  description: "List the signed-in user's EASY ADs projects with their render status.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Max projects to return."),
    video_status: z
      .enum(["none", "queued", "processing", "ready", "error"])
      .optional()
      .describe("Optional filter on video render status."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, video_status }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("projects")
      .select(
        "id,title,brief,status,video_status,aspect_ratio,duration_seconds,credits_used,brand_id,series_id,series_index,thumbnail_url,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (video_status) query = query.eq("video_status", video_status);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});
