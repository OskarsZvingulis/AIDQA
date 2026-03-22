export function isUrlSafe(urlStr: string): boolean {
  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    return false
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const hostname = url.hostname.toLowerCase()

  // Block localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false

  // Block IPv4-mapped IPv6 and link-local / unique-local IPv6
  if (hostname.startsWith('::ffff:')) return false
  if (/^fe80:/i.test(hostname)) return false
  if (/^fc00:/i.test(hostname) || /^fd[0-9a-f]{2}:/i.test(hostname)) return false

  // Block common internal hostnames
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false

  // Parse IPv4
  const ipv4Parts = hostname.split('.')
  if (ipv4Parts.length === 4) {
    const parts = ipv4Parts.map(Number)
    if (parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
      const [a, b] = parts
      // 10.x.x.x
      if (a === 10) return false
      // 172.16-31.x.x
      if (a === 172 && b >= 16 && b <= 31) return false
      // 192.168.x.x
      if (a === 192 && b === 168) return false
      // 169.254.x.x (link-local)
      if (a === 169 && b === 254) return false
      // 127.x.x.x
      if (a === 127) return false
    }
  }

  return true
}
