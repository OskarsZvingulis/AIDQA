const steps = [
  {
    number: '01',
    title: 'Paste a URL',
    description: 'Add any publicly accessible URL. No code changes, no browser plugins.',
  },
  {
    number: '02',
    title: 'Approve a baseline',
    description: 'AIDQA captures a screenshot. Review it and click approve — that\'s your reference.',
  },
  {
    number: '03',
    title: 'Get alerted on drift',
    description: 'AIDQA checks on your schedule. When pixels shift beyond your threshold, you get an alert with an AI explanation.',
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="mb-12 text-center text-2xl font-bold tracking-tight text-gray-900">
          Up and running in two minutes
        </h2>
        <div className="space-y-10">
          {steps.map((step) => (
            <div key={step.number} className="flex items-start gap-6">
              <span className="shrink-0 font-mono text-3xl font-bold text-[hsl(243,75%,59%)]">
                {step.number}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-gray-500">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
