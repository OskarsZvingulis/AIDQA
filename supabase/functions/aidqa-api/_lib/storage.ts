import { supabase } from './supabaseServer.ts'

const BUCKET = 'aidqa'

export async function uploadFile(path: string, data: Uint8Array, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, data, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
}

export async function downloadFile(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`)
  return new Uint8Array(await data.arrayBuffer())
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`)
  return data.signedUrl
}
