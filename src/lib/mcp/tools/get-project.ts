import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_project",
  title: "Get ad project",
  description: "Get one EASY ADs project with its script and storyboard scenes.",
  inputSchema: { project_id: z.string().uuid().describe("The project id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const [project, script, storyboard] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).maybeSingle(),
      supabase.from("scripts").select("*").eq("project_id", project_id).maybeSingle(),
      supabase.from("storyboards").select("*").eq("project_id", project_id).maybeSingle(),
    ]);
    if (project.error) throw new ToolError(project.error.message);
    if (!project.data) throw new ToolError("Project not found");
    const payload = {
      project: project.data,
      script: script.data ?? null,
      storyboard: storyboard.data ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
