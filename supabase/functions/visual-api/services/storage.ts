// Supabase Storage Service - Image storage and retrieval

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const storageBucket = Deno.env.get("STORAGE_BUCKET") || "visual";

const supabase = createClient(supabaseUrl, supabaseKey);

export interface UploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadImage(
  projectId: string,
  baselineId: string,
  fileName: string,
  imageBuffer: Uint8Array
): Promise<UploadResult> {
  const path = `${projectId}/${baselineId}/${fileName}`;

  console.log(`[STORAGE] Uploading to: ${storageBucket}/${path}`);

  const { data, error } = await supabase.storage
    .from(storageBucket)
    .upload(path, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error("[STORAGE] Upload failed:", error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(storageBucket)
    .getPublicUrl(path);

  console.log(`[STORAGE] Upload successful: ${urlData.publicUrl}`);

  return {
    path,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Get signed URL for private image (expires in 1 hour by default)
 */
export async function getSignedUrl(
  path: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Download image from storage
 */
export async function downloadImage(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .download(path);

  if (error) {
    throw new Error(`Storage download failed: ${error.message}`);
  }

  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Delete image from storage
 */
export async function deleteImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(storageBucket).remove([path]);

  if (error) {
    throw new Error(`Storage deletion failed: ${error.message}`);
  }
}
