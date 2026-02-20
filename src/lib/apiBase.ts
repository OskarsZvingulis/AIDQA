/**
 * Get API base URL for fetch requests.
 * - Local dev: returns '' (empty) so Vite proxy handles /api routes
 * - Hosted (Vercel): uses VITE_API_BASE_URL (Supabase Edge Function URL)
 * 
 * Example Supabase URL: https://your-project.supabase.co/functions/v1/visual-api
 */
export function getApiBaseUrl(): string {
  const raw = (import.meta as unknown as { env?: Record<string, unknown> })?.env?.VITE_API_BASE_URL;
  
  // For hosted deployments, use VITE_API_BASE_URL
  // For local dev, return empty string (Vite proxy handles /api)
  const base = typeof raw === 'string' ? raw : '';
  
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/**
 * Get Supabase project base URL (without /functions/v1/visual-api suffix).
 */
export function getSupabaseProjectUrl(): string {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return '';
  return apiBase.replace(/\/functions\/v1\/visual-api\/?$/, '');
}

/**
 * Get Supabase anon key for API authentication
 */
export function getSupabaseAnonKey(): string {
  const key = (import.meta as unknown as { env?: Record<string, unknown> })?.env?.VITE_SUPABASE_ANON_KEY;
  return typeof key === 'string' ? key : '';
}

/**
 * Get headers for API requests with the authenticated user's session token.
 */
export async function getApiHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('./supabaseClient');
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

/**
 * Check if we're in hosted mode (Vercel, etc.) and API base URL is required
 */
export function isHostedMode(): boolean {
  return !import.meta.env.DEV;
}

/**
 * Validate API configuration for hosted mode
 */
export function validateApiConfig(): { valid: boolean; error?: string } {
  if (isHostedMode()) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        valid: false,
        error: 'VITE_API_BASE_URL is required for hosted deployments. Set it to your Supabase Edge Function URL.',
      };
    }
  }
  return { valid: true };
}
