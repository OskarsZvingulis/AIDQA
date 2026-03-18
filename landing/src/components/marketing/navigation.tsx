"use client";

import { ThemeToggle } from "./theme-toggle";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2";

export function Navigation() {

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-[var(--background)]/80 border-b border-[var(--border-subtle)]">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center">
            <button
              className={`text-2xl tracking-tight rounded ${focusRing}`}
              style={{ fontWeight: 800 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to top"
            >
              AIDQA
            </button>
          </div>

          {/* Right: CTAs + Theme Toggle + Hamburger */}
          <div className="flex items-center gap-4">
            <button
              className={`hidden sm:block px-6 py-3 min-h-[44px] rounded-full hover:bg-[var(--card)] transition-colors ${focusRing}`}
              onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
            >
              Watch demo
            </button>
            <button
              className={`px-6 py-3 min-h-[44px] rounded-full bg-[var(--accent-orange)] text-white hover:opacity-90 transition-opacity ${focusRing}`}
              onClick={() => document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" })}
            >
              Join early access
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
