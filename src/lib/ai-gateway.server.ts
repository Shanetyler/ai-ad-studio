// Server-only helper for Lovable AI Gateway (OpenAI-compatible).
const BASE = "https://ai.gateway.lovable.dev/v1";

export async function aiChat(opts: {
  model?: string;
  system?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: unknown }>;
  prompt?: string;
  json?: boolean;
}) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const messages =
    opts.messages ??
    [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: opts.prompt ?? "" },
    ];
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: opts.model ?? "openai/gpt-5.5",
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

export async function aiJson<T>(opts: Parameters<typeof aiChat>[0]): Promise<T> {
  const raw = await aiChat({ ...opts, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI response was not valid JSON");
  }
}

/**
 * Generate an image (non-streaming). Returns a base64 PNG data buffer + mime.
 * Uses Gemini image models via chat-completions with modalities.
 */
export async function aiImage(opts: {
  prompt: string;
  referenceImageUrl?: string; // https or data:image/...;base64,...
  model?: string;
}): Promise<{ base64: string; mime: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: opts.prompt },
  ];
  if (opts.referenceImageUrl) {
    content.push({ type: "image_url", image_url: { url: opts.referenceImageUrl } });
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3-pro-image",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI image ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: Array<{
      message: {
        images?: Array<{ image_url?: { url?: string } }>;
        content?: unknown;
      };
    }>;
  };
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) throw new Error("No image returned");
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data url");
  return { mime: match[1], base64: match[2] };
}
