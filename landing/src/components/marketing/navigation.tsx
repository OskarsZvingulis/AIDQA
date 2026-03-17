"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const navLinks = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#demo", label: "Demo" },
  { href: "#early-access", label: "Early Access" },
];

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2";

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-[var(--background)]/80 border-b border-[var(--border-subtle)]">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Desktop Links */}
          <div className="flex items-center gap-12">
            <button
              className={`text-2xl tracking-tight rounded ${focusRing}`}
              style={{ fontWeight: 800 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to top"
            >
              AIDQA
            </button>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`hover:opacity-70 transition-opacity rounded ${focusRing}`}
                >
                  {link.label}
                </a>
              ))}
            </div>
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

            {/* Hamburger — mobile only */}
            <button
              className={`md:hidden p-2 rounded-lg hover:bg-[var(--card)] transition-colors ${focusRing}`}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--background)]">
          <div className="max-w-[1200px] mx-auto px-6 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`py-3 text-lg hover:opacity-70 transition-opacity rounded ${focusRing}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
