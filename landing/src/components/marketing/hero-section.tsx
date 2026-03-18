"use client";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2";

export function HeroSection() {
  return (
    <section className="py-20 md:py-32">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Headline & CTAs */}
          <div>
            <p className="text-sm uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
              Design Intelligence Layer for AI Builders
            </p>
            <h1 className="mb-6 text-[3.5rem] md:text-[4.5rem] leading-[1.05]">
              Catch what's wrong with your AI-generated UI before users do
            </h1>
            <p className="text-lg mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              AI builders move fast. The output often drifts — spacing breaks, hierarchy weakens, components go inconsistent. AIDQA measures objective design signals and tells you exactly what to fix.
            </p>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Not taste. Not opinion. Measurable issues: contrast ratios, spacing rhythm, alignment offsets, accessibility thresholds.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <button
                className={`px-8 py-4 min-h-[44px] rounded-full bg-[var(--accent-orange)] text-white hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${focusRing}`}
                onClick={() => document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" })}
              >
                Scan your UI free
              </button>
              <button
                className={`px-8 py-4 min-h-[44px] rounded-full border-2 border-[var(--foreground)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all ${focusRing}`}
                onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              >
                Watch demo
              </button>
            </div>
          </div>

          {/* Right: Product Demo Video — click scrolls to demo section */}
          <button
            className={`relative group rounded-2xl overflow-hidden shadow-2xl w-full aspect-video bg-[var(--card)] cursor-pointer ${focusRing}`}
            onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
            aria-label="Scroll to demo video"
          >
            <video
              src="/demo.mp4"
              autoPlay
              loop
              muted
              playsInline
              poster="/demo-poster.png"
              className="w-full h-full object-cover pointer-events-none"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/70 text-white text-sm font-medium px-4 py-2 rounded-full">
                Watch demo ↓
              </span>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
