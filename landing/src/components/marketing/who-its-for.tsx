const audiences = [
  {
    role: "Indie hackers and solo builders",
    description: "Using v0, Lovable, or Cursor — who can tell the output feels off but can't diagnose why.",
    detail: "Get a prioritized fix list without hiring a designer.",
  },
  {
    role: "Startup product teams",
    description: "Generating UI quickly without strong design review processes.",
    detail: "Catch issues before handoff, not after launch.",
  },
  {
    role: "Frontend and design engineers",
    description: "Who want objective signals before a PR ships a visual regression.",
    detail: "Replace manual pre-release visual checks with a structured scan.",
  },
  {
    role: "Design systems teams",
    description: "Who need consistency enforcement without auditing every AI-generated screen manually.",
    detail: "Surface component drift and token violations at scale.",
  },
];

export function WhoItsFor() {
  return (
    <section className="py-20 md:py-32">
      <div className="max-w-[1100px] mx-auto px-6 md:px-8">
        <h2 className="mb-12 text-center">Built for teams shipping UI fast</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {audiences.map((a) => (
            <div
              key={a.role}
              className="p-6 rounded-xl bg-[var(--card)] border border-[var(--border-subtle)]"
            >
              <h4 className="mb-2 text-base">{a.role}</h4>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>{a.description}</p>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{a.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
