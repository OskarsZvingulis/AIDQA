const problems = [
  {
    title: "Layout and spacing break silently",
    description: "Spacing drifts between sections. Alignment offsets appear. Components that should match don't. None of it triggers an error.",
    outcome: "Users notice before you do.",
  },
  {
    title: "Hierarchy collapses under pressure",
    description: "The primary action competes with secondary content. Heading sizes blend together. The eye has nowhere to go.",
    outcome: "Conversion drops. Trust erodes.",
  },
  {
    title: "Accessibility risks ship quietly",
    description: "Contrast ratios fall below WCAG AA. Touch targets shrink below 44px. These don't fail visually — they fail people.",
    outcome: "Legal exposure. Real users excluded.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-20 md:py-32 bg-[var(--card)]">
      <div className="max-w-[900px] mx-auto px-6 md:px-8 text-center">
        <h2 className="mb-8">AI UI is fast. The quality gap is real.</h2>
        <p className="text-xl md:text-2xl mb-12 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          AI builders can generate a screen in seconds. But the output usually lands in a dangerous middle zone: looks almost right, but something measurably isn't.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="p-6 rounded-xl bg-[var(--background)] border border-[var(--border-subtle)] text-left"
            >
              <h4 className="mb-3 text-base">{problem.title}</h4>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>{problem.description}</p>
              <p className="text-sm font-semibold" style={{ color: "var(--accent-orange)" }}>{problem.outcome}</p>
            </div>
          ))}
        </div>

        <p className="text-lg" style={{ color: "var(--text-muted)" }}>
          Experienced designers catch this in a review. Most builders don't have one. The cost is{" "}
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>design debt that compounds with every iteration — and a product that feels slightly off before a single word is read.</span>
        </p>
      </div>
    </section>
  );
}
