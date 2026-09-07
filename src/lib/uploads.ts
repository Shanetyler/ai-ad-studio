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

/**
 * Uploads a character reference image into the private project-assets bucket under
 * an owner-scoped, character-scoped path. Returns the storage path (never a public URL).
 */
export async function uploadCharacterReference(file: File, characterKey: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload reference images.");
  if (!file.type.startsWith("image/")) throw new Error("Reference images must be PNG, JPG or WEBP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Reference images must be smaller than 8 MB.");

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeKey = characterKey.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "draft";
  const path = `${uid}/characters/${safeKey}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("project-assets").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}
