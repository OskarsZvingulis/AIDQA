interface LandingHeroProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
  badge?: string;
}

export default function LandingHero({ headline, subheadline, ctaText, ctaHref, badge }: LandingHeroProps) {
  return (
    <section className="bg-[hsl(222,47%,11%)] px-6 py-24 text-center">
      <div className="mx-auto max-w-3xl">
        {badge && (
          <span className="mb-6 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/80">
            {badge}
          </span>
        )}
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
          {headline}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-white/60">
          {subheadline}
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-lg bg-[hsl(243,75%,59%)] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[hsl(243,68%,48%)] transition-colors"
          >
            {ctaText}
          </a>
          <p className="text-xs text-white/30">No credit card required</p>
        </div>
      </div>
    </section>
  );
}
