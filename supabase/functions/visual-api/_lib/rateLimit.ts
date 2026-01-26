// Simple in-memory rate limiting (per-IP)
// Note: Edge Functions are stateless, so this resets on cold start
// For production, consider Redis or Supabase rate limiting extensions

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30;

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const maxRequests = parseInt(Deno.env.get('RATE_LIMIT_PER_MINUTE') || String(DEFAULT_MAX_REQUESTS));

  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // Within existing window
  entry.count += 1;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

export function getClientIP(req: Request): string {
  // Try common headers for IP address
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a placeholder (Edge Functions don't expose direct socket)
  return 'unknown';
}
