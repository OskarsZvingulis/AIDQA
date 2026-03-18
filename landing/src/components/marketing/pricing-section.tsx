import { CheckCircle } from "lucide-react";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)] focus-visible:ring-offset-2";

const tiers = [
  {
    name: "Starter",
    price: "$0",
    period: "free",
    description: "Try the scanner. No card required.",
    cta: "Start free",
    ctaVariant: "outline" as const,
    features: [
      "3 scans included",
      "URL and screenshot input",
      "Prioritized findings with evidence",
      "Repair guidance per finding",
    ],
  },
  {
    name: "Builder",
    price: "$19",
    period: "/ month",
    description: "For indie hackers shipping UI regularly.",
    cta: "Join waitlist",
    ctaVariant: "primary" as const,
    highlight: true,
    features: [
      "50 scans / month",
      "Full deterministic + AI analysis",
      "Accessibility checks (WCAG AA)",
      "Overlay evidence viewer",
      "Scan history",
    ],
  },
  {
    name: "Team",
    price: "$49",
    period: "/ month",
    description: "For startup teams with frequent AI UI output.",
    cta: "Join waitlist",
    ctaVariant: "outline" as const,
    features: [
      "Unlimited scans",
      "Everything in Builder",
      "Priority processing",
      "Team scan history",
      "Early access to new checks",
    ],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-32">
      <div className="max-w-[1100px] mx-auto px-6 md:px-8">
        <div className="text-center mb-16">
          <h2 className="mb-4">Simple pricing</h2>
          <p className="text-lg" style={{ color: "var(--text-muted)" }}>
            Start free. Pay when it saves you more than it costs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 border flex flex-col ${
                tier.highlight
                  ? "border-[var(--accent-orange)] bg-[var(--card)] shadow-lg"
                  : "border-[var(--border-subtle)] bg-[var(--card)]"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full text-xs font-semibold text-white bg-[var(--accent-orange)]">
                    Most popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-muted)" }}>{tier.name}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>{tier.period}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--accent-orange)" }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full px-6 py-3 min-h-[44px] rounded-full font-medium transition-all ${focusRing} ${
                  tier.ctaVariant === "primary"
                    ? "bg-[var(--accent-orange)] text-white hover:opacity-90 shadow-md"
                    : "border-2 border-[var(--foreground)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)]"
                }`}
                onClick={() => document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" })}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-sm" style={{ color: "var(--text-muted)" }}>
          Pricing is in early access — locked-in rates for waitlist members.
        </p>
      </div>
    </section>
  );
}
