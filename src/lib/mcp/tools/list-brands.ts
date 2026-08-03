import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_brands",
  title: "List brands",
  description: "List the signed-in user's brand profiles in EASY ADs.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(20).describe("Max brands to return.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("brands")
      .select("id,name,tagline,tone,website_url,primary_color,secondary_color,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { brands: data ?? [] },
    };
  },
});
