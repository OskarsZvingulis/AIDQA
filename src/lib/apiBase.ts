export function getApiBaseUrl(): string {
  const raw = (import.meta as unknown as { env?: Record<string, unknown> })?.env?.VITE_API_BASE_URL;
  const base = typeof raw === 'string' ? raw : '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}
