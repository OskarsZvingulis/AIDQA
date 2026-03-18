import { DollarSign, Clock, Shield, AlertCircle, Smile } from "lucide-react";

export function WhyPeoplePay() {
  const reasons = [
    {
      icon: DollarSign,
      title: "Protect revenue flows",
      description: "Catch layout drift and broken interactive patterns before they cost conversions.",
    },
    {
      icon: Clock,
      title: "Save review time every iteration",
      description: "Replace manual visual checks with a structured scan and a prioritized fix list.",
    },
    {
      icon: Shield,
      title: "Avoid trust-killing inconsistency",
      description: "A product can function correctly but still feel unreliable. AIDQA catches the gap.",
    },
    {
      icon: AlertCircle,
      title: "Catch accessibility risk early",
      description: "Surface contrast failures below WCAG AA and touch targets below 44×44px before handoff.",
    },
    {
      icon: Smile,
      title: "Ship with objective confidence",
      description: "Fewer missed issues, fewer regressions, fewer post-ship corrections.",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-[var(--card)]">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="text-center mb-16">
          <h2 className="mb-8">What ships better when you add this layer</h2>
          <p className="text-xl md:text-2xl max-w-[800px] mx-auto" style={{ color: "var(--text-muted)" }}>
            One "looks broken" moment from a user costs more than the tool. Here's what AIDQA catches before it gets there.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {reasons.map((reason) => {
            const Icon = reason.icon;
            return (
              <div
                key={reason.title}
                className="p-6 rounded-xl bg-[var(--background)] border border-[var(--border-subtle)]"
              >
                <div className="w-12 h-12 rounded-lg bg-[var(--accent-orange)] bg-opacity-10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" style={{ color: "var(--accent-orange)" }} />
                </div>

                <h4 className="mb-2">{reason.title}</h4>

                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {reason.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-lg mb-2" style={{ color: "var(--text-muted)" }}>
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>One prevented broken release pays for AIDQA.</span>
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Used by indie hackers and startup teams building with v0, Lovable, and Cursor.
          </p>
        </div>
      </div>
    </section>
  );
}
