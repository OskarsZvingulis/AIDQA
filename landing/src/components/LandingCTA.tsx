interface LandingCTAProps {
  headline: string;
  ctaText: string;
  ctaHref: string;
}

export default function LandingCTA({ headline, ctaText, ctaHref }: LandingCTAProps) {
  return (
    <section className="bg-[hsl(222,47%,11%)] py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          {headline}
        </h2>
        <a
          href={ctaHref}
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-[hsl(243,75%,59%)] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[hsl(243,68%,48%)] transition-colors"
        >
          {ctaText}
        </a>
        <p className="mt-4 text-xs text-white/30">No credit card required</p>
      </div>
    </section>
  );
}
