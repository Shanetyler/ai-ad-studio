import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_brand",
  title: "Create brand",
  description: "Create a brand profile for the signed-in user in EASY ADs.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Brand name."),
    tagline: z.string().trim().nullish().describe("Optional tagline."),
    tone: z.string().trim().nullish().describe("Optional brand tone of voice."),
    website_url: z.string().url().nullish().describe("Optional brand website URL."),
    primary_color: z.string().trim().nullish().describe("Optional primary hex color."),
    secondary_color: z.string().trim().nullish().describe("Optional secondary hex color."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Missing user id in token");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("brands")
      .insert({
        owner_id: userId,
        name: input.name,
        tagline: input.tagline ?? null,
        tone: input.tone ?? null,
        website_url: input.website_url ?? null,
        primary_color: input.primary_color ?? null,
        secondary_color: input.secondary_color ?? null,
      })
      .select("id,name,tagline,tone,website_url")
      .single();
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { brand: data },
    };
  },
});
