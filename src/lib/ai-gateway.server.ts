// Server-only helper for Lovable AI Gateway (OpenAI-compatible).
const BASE = "https://ai.gateway.lovable.dev/v1";

export async function aiChat(opts: {
  model?: string;
  system?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
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
    // Try to extract a JSON block
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI response was not valid JSON");
  }
}
