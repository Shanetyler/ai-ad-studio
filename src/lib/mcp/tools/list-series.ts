import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_series",
  title: "List ad series",
  description: "List the signed-in user's multi-episode ad series in EASY ADs.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(20).describe("Max series to return.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("series")
      .select("id,title,brief,length,timeline_type,status,aspect_ratio,brand_id,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { series: data ?? [] },
    };
  },
});
