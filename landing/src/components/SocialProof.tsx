const quotes = [
  {
    text: "We caught a broken header layout in production within minutes of deploying. No test suite needed.",
    author: "Frontend lead at a SaaS startup",
  },
  {
    text: "I paste the URL, approve the baseline, and forget about it. AIDQA alerts me when something actually breaks.",
    author: "Solo developer",
  },
  {
    text: "The AI explanation makes it immediately clear what changed and whether it matters.",
    author: "QA engineer",
  },
];

export default function SocialProof() {
  return (
    <section className="bg-[hsl(215,28%,97%)] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-12 text-center text-2xl font-bold tracking-tight text-gray-900">
          What teams are saying
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {quotes.map((q, i) => (
            <figure key={i} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <blockquote className="text-sm leading-relaxed text-gray-700">
                &ldquo;{q.text}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-xs font-medium text-gray-400">
                — {q.author}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
