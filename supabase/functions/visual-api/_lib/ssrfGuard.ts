// SSRF (Server-Side Request Forgery) protection
// Blocks localhost, private IPs, and link-local addresses

export function isUrlSafe(urlString: string): { safe: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { safe: false, error: 'Only HTTP/HTTPS protocols allowed' };
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return { safe: false, error: 'Localhost URLs are not allowed' };
    }

    // Block private IP ranges
    if (isPrivateIP(hostname)) {
      return { safe: false, error: 'Private IP addresses are not allowed' };
    }

    // Block link-local addresses
    if (hostname.startsWith('169.254.') || hostname.startsWith('fe80:')) {
      return { safe: false, error: 'Link-local addresses are not allowed' };
    }

    // Optional: Check against allowlist if configured
    const allowedHosts = Deno.env.get('ALLOWED_HOSTS');
    if (allowedHosts) {
      const allowed = allowedHosts.split(',').map(h => h.trim().toLowerCase());
      if (!allowed.includes(hostname)) {
        return { safe: false, error: `Host ${hostname} is not in allowlist` };
      }
    }

    return { safe: true };
  } catch (error) {
    return { safe: false, error: 'Invalid URL format' };
  }
}

function isPrivateIP(hostname: string): boolean {
  // Check for IPv4 private ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const [, a, b, c, d] = match.map(Number);

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // Loopback 127.0.0.0/8
    if (a === 127) return true;

    // 0.0.0.0/8
    if (a === 0) return true;
  }

  // Check for IPv6 private ranges (simplified)
  if (hostname.includes(':')) {
    // Block ::1 (loopback)
    if (hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') return true;

    // Block fc00::/7 (ULA)
    if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true;
  }

  return false;
}
