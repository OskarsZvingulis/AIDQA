export function Footer() {
  return (
    <footer className="py-12 border-t border-[var(--border-subtle)]">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="text-xl tracking-tight" style={{ fontWeight: 800 }}>
              AIDQA
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Design Drift Monitoring
            </p>
          </div>

          <div className="flex flex-wrap gap-6 justify-center">
            <a href="#product" className="text-sm hover:opacity-70 transition-opacity rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2">Product</a>
            <a href="#how-it-works" className="text-sm hover:opacity-70 transition-opacity rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2">How it works</a>
            <a href="#demo" className="text-sm hover:opacity-70 transition-opacity rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2">Demo</a>
            <a href="#early-access" className="text-sm hover:opacity-70 transition-opacity rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2">Early Access</a>
            <a href="/privacy" className="text-sm hover:opacity-70 transition-opacity rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2">Privacy</a>
          </div>

          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            <a href="mailto:hello@aidqa.com" className="hover:opacity-70 transition-opacity rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2">
              hello@aidqa.com
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[var(--border-subtle)] text-center text-xs" style={{ color: "var(--text-muted)" }}>
          © 2026 AIDQA. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
