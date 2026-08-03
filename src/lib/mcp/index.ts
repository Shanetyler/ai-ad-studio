import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBrandsTool from "./tools/list-brands";
import createBrandTool from "./tools/create-brand";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import listSeriesTool from "./tools/list-series";
import getCreditBalanceTool from "./tools/get-credit-balance";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// Supabase value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "ai-ad-studio",
  title: "AI Ad Studio",
  version: "0.1.0",
  instructions:
    "Tools for EASY ADs, an AI ad-video studio. Read the signed-in user's brands, ad projects (with scripts and storyboards), series, and credit balance, and create new brand profiles. Video rendering itself happens in the app.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listBrandsTool,
    createBrandTool,
    listProjectsTool,
    getProjectTool,
    listSeriesTool,
    getCreditBalanceTool,
  ],
});
