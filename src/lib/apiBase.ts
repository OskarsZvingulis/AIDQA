export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  const base = typeof raw === 'string' ? raw : ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('./supabaseClient')
  const { data: { session }, error } = await supabase.auth.getSession()

  if (!session?.access_token) return {}

  // Only refresh if we know for certain the token is expired (expires_at exists and is in the past)
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = session.expires_at
  if (expiresAt && expiresAt < now + 30) {
    const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed?.access_token) {
      return {
        'Authorization': `Bearer ${refreshed.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      }
    }
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  }
}
