"use client";

import { Play } from "lucide-react";
import { useState } from "react";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2";

export function HeroSection() {
  const [isVideoActive, setIsVideoActive] = useState(false);

  return (
    <section className="py-20 md:py-32">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Headline & CTAs */}
          <div>
            <h1 className="mb-6 text-[3.5rem] md:text-[4.5rem] leading-[1.05]">
              AI Design QA for Vibe Coders
            </h1>
            <p className="text-xl md:text-2xl mb-4" style={{ color: "var(--text-muted)" }}>
              The safety layer for AI-generated interfaces.
            </p>
            <p className="text-lg mb-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              AI builds UI fast. We help you ship UI that feels clean, consistent, and trustworthy — before users feel something is "off".
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <button
                className={`px-8 py-4 min-h-[44px] rounded-full bg-[var(--accent-orange)] text-white hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${focusRing}`}
                onClick={() => document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" })}
              >
                Join the waitlist
              </button>
              <button
                className={`px-8 py-4 min-h-[44px] rounded-full border-2 border-[var(--foreground)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all ${focusRing}`}
                onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              >
                View demo report
              </button>
            </div>

            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No design system needed. No heavy setup.
            </p>
          </div>

          {/* Right: Product Preview */}
          <button
            className={`relative group rounded-2xl overflow-hidden shadow-2xl w-full text-left ${focusRing}`}
            aria-label="Preview demo video"
            onMouseEnter={() => setIsVideoActive(true)}
            onMouseLeave={() => setIsVideoActive(false)}
            onFocus={() => setIsVideoActive(true)}
            onBlur={() => setIsVideoActive(false)}
            onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
          >
            <div className="aspect-video bg-[var(--card)] flex items-center justify-center">
              <div className="w-full h-full bg-[var(--card-muted)] flex items-center justify-center">
                <span className="text-4xl opacity-20" aria-hidden="true">▶</span>
              </div>
            </div>

            {/* Overlay on hover/focus */}
            <div
              className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${
                isVideoActive ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden="true"
            >
              <div className="flex items-center gap-3 text-white">
                <Play className="w-8 h-8" fill="white" />
                <span className="text-xl">View demo</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
