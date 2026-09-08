import { supabase } from "@/integrations/supabase/client";

const YEAR = 60 * 60 * 24 * 365;

/** Uploads an image (logo / product photo) to private storage and returns a long-lived signed URL. */
export async function uploadAdImage(file: File, folder: "logos" | "scenes"): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload files.");
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (PNG, JPG, WEBP).");
  if (file.size > 8 * 1024 * 1024) throw new Error("Images must be smaller than 8 MB.");

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("project-assets").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data: signed, error: sErr } = await supabase.storage
    .from("project-assets")
    .createSignedUrl(path, YEAR);
  if (sErr) throw new Error(sErr.message);
  return signed.signedUrl;
}

/** Uploads the rendered ad video and returns its storage path. */
export async function uploadAdVideo(projectId: string, blob: Blob, ext: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to save a render.");
  const path = `${uid}/${projectId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("ad-videos").upload(path, blob, {
    contentType: blob.type || "video/webm",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Reference images are limited to these formats (no arbitrary image/* types). */
export const REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const REFERENCE_MAX_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Client-side guard so bad files never reach storage. */
export function validateReferenceFile(file: File): string | null {
  if (!(REFERENCE_MIME_TYPES as readonly string[]).includes(file.type))
    return "Reference images must be JPG, PNG or WEBP.";
  if (file.size > REFERENCE_MAX_BYTES) return "Reference images must be smaller than 8 MB.";
  return null;
}

/**
 * Uploads a character reference image into the private project-assets bucket under
 * an owner-scoped, character-scoped path. Returns the storage path (never a public URL).
 *
 * Note: type/size checks here are client-side, plus the bucket's own size limit.
 * TODO: add server-side byte/dimension inspection (e.g. a server function that
 * re-reads the object header) if we ever accept references from untrusted clients.
 */
export async function uploadCharacterReference(file: File, characterId: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload reference images.");
  const invalid = validateReferenceFile(file);
  if (invalid) throw new Error(invalid);

  const ext = EXT_BY_MIME[file.type] ?? "png";
  const safeKey = characterId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  if (!safeKey) throw new Error("Save the character before uploading references.");
  const path = `${uid}/characters/${safeKey}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("project-assets").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

