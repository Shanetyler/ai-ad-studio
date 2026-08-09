import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CastSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["character", "voice"]),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).default(""),
  attributes: z.record(z.string(), z.string()).default({}),
  reference_url: z.string().max(1000).optional(),
  rights_confirmed: z.boolean(),
});

export const listCast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cast_members")
      .select("id, kind, name, description, attributes, reference_url, rights_confirmed, provider_ref, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CastSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.rights_confirmed) {
      throw new Error("You must confirm you have the rights and consent to use this likeness or voice.");
    }
    const { supabase, userId } = context;
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabase
        .from("cast_members")
        .update(fields as any)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: created, error } = await supabase
      .from("cast_members")
      .insert({ ...(fields as any), owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteCast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cast_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
