"use client";

import { useState } from "react";
import { Play, Download, X } from "lucide-react";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2";

export function DemoSection() {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <section id="demo" className="py-20 md:py-32 bg-[var(--card)]">
        <div className="max-w-[1200px] mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <h2 className="mb-4">See an AIDQA report in 60 seconds</h2>
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>
              Submit a URL or screenshot. Get prioritized findings with evidence regions and repair guidance — no setup required.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <button
              className={`relative group w-full aspect-video bg-[var(--background)] rounded-2xl shadow-2xl overflow-hidden mb-8 cursor-pointer ${focusRing}`}
              onClick={() => setLightboxOpen(true)}
              aria-label="Watch demo video fullscreen"
            >
              <video
                src="/demo.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-3 bg-black/70 text-white px-6 py-3 rounded-full">
                  <Play className="w-5 h-5" fill="white" />
                  <span className="font-medium">Watch fullscreen</span>
                </div>
              </div>
            </button>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                className={`px-8 py-4 min-h-[44px] rounded-full bg-[var(--accent-orange)] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${focusRing}`}
                onClick={() => setLightboxOpen(true)}
              >
                <Play className="w-5 h-5" aria-hidden="true" />
                Watch demo
              </button>
              <button
                className={`px-8 py-4 min-h-[44px] rounded-full border-2 border-[var(--foreground)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all flex items-center justify-center gap-2 ${focusRing}`}
                onClick={() => document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Download className="w-5 h-5" aria-hidden="true" />
                Download sample report
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close video"
          >
            <X className="w-6 h-6" />
          </button>
          <video
            src="/demo.mp4"
            autoPlay
            controls
            className="max-w-5xl w-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
