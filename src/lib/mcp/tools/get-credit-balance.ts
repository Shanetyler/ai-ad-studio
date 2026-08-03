import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_credit_balance",
  title: "Get credit balance",
  description: "Get the signed-in user's remaining EASY ADs credit balance.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Missing user id in token");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("credit_balance", { _user_id: userId });
    if (error) throw new ToolError(error.message);
    const credits = typeof data === "number" ? data : 0;
    return {
      content: [{ type: "text", text: `${credits} credits remaining` }],
      structuredContent: { credits },
    };
  },
});
