import type { Metadata } from 'next';
import LandingNavBar from '@/components/LandingNavBar';
import LandingHero from '@/components/LandingHero';
import ValueProps from '@/components/ValueProps';
import HowItWorks from '@/components/HowItWorks';
import LandingCTA from '@/components/LandingCTA';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Automated Accessibility Audit for AI-Generated UI | AIDQA',
  description:
    'Catch accessibility issues in AI-generated interfaces before they reach users. AIDQA checks contrast ratios against WCAG AA, touch target sizes, and structural accessibility signals — no CI setup required.',
  keywords: [
    'accessibility audit',
    'automated accessibility audit',
    'accessibility checker for design systems',
    'wcag accessibility checker',
    'ai ui accessibility check',
    'prevent accessibility errors before handoff',
  ],
};

const CTA_HREF = 'https://app.aidesignqa.com/signup?utm_source=lp&utm_campaign=accessibility-audit';

const VALUE_PROPS = [
  'WCAG AA contrast ratio check — measured from computed CSS color values, not pixel sampling',
  'Touch target audit — flags interactive elements below 44×44px (WCAG 2.5.5 target size)',
  'Works on screenshots and live URLs — no codebase access or CI pipeline required',
  'Returns specific findings with measured values, not generic "improve accessibility" warnings',
  'Integrates into pre-ship review — not a post-production monitoring tool',
];

const checks = [
  {
    category: 'Contrast',
    what: 'Text contrast ratio vs background',
    threshold: '4.5:1 normal text · 3:1 large text (≥18px or ≥14px bold)',
    severity: 'Critical',
  },
  {
    category: 'Touch targets',
    what: 'Interactive element bounding box size',
    threshold: '44×44px minimum (WCAG 2.5.5)',
    severity: 'High',
  },
  {
    category: 'Visual hierarchy',
    what: 'Heading scale ratio to body text',
    threshold: 'h1 ≥1.5× body · h2 ≥1.25× body',
    severity: 'Medium',
  },
  {
    category: 'Spacing consistency',
    what: 'Spacing token adherence (multiples of 4px)',
    threshold: 'Values not on the 4px grid flagged',
    severity: 'Medium',
  },
];

export default function AccessibilityAuditPage() {
  return (
    <>
      <LandingNavBar />
      <main>
        <LandingHero
          badge="Accessibility Audit"
          headline="Automated accessibility audit for AI-generated interfaces"
          subheadline="AI builders generate UI fast — but they don't apply WCAG constraints by default. AIDQA audits AI-generated screens for contrast failures, undersized touch targets, and structural accessibility risks. No CI setup, no codebase access. Paste a URL or screenshot and get a prioritized findings list in under 60 seconds."
          ctaText="Run a free accessibility audit"
          ctaHref={CTA_HREF}
        />

        <section className="py-20 bg-[hsl(215,28%,97%)]">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="mb-4 text-center text-2xl font-bold tracking-tight text-gray-900">
              What AIDQA checks
            </h2>
            <p className="mb-10 text-center text-gray-600">
              Every check is measurable and defensible — not a subjective opinion about design.
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-5 py-4 font-semibold text-gray-700">Category</th>
                    <th className="px-5 py-4 font-semibold text-gray-700">What is checked</th>
                    <th className="px-5 py-4 font-semibold text-gray-700">Threshold</th>
                    <th className="px-5 py-4 font-semibold text-gray-700">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => (
                    <tr key={c.category} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-4 font-medium text-gray-800">{c.category}</td>
                      <td className="px-5 py-4 text-gray-600">{c.what}</td>
                      <td className="px-5 py-4 text-gray-600">{c.threshold}</td>
                      <td className={`px-5 py-4 font-semibold ${
                        c.severity === 'Critical' ? 'text-red-600' :
                        c.severity === 'High' ? 'text-orange-500' : 'text-yellow-600'
                      }`}>{c.severity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <ValueProps items={VALUE_PROPS} />
        <HowItWorks />
        <LandingCTA
          headline="Catch accessibility issues before your users do."
          ctaText="Run a free accessibility audit"
          ctaHref={CTA_HREF}
        />
      </main>
      <Footer />
    </>
  );
}
