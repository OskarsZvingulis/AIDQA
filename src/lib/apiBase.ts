export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  const base = typeof raw === 'string' ? raw : ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('./supabaseClient')
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
    headers['apikey'] = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  }
  return headers
}
