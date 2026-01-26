// Supabase Storage helpers for uploading/downloading artifacts

import { getSupabaseServer } from './supabaseServer.ts';

const BUCKET_NAME = Deno.env.get('STORAGE_BUCKET') || 'visual';
const SIGNED_URL_EXPIRY = 21600; // 6 hours

export async function uploadFile(
  path: string,
  data: Uint8Array,
  contentType: string
): Promise<void> {
  const supabase = getSupabaseServer();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, data, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

export async function getSignedUrl(path: string): Promise<string> {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
  }

  return data.signedUrl;
}

export async function downloadFile(path: string): Promise<Uint8Array> {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);

  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message || 'File not found'}`);
  }

  return new Uint8Array(await data.arrayBuffer());
}
