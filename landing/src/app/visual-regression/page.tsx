import type { Metadata } from 'next';
import LandingNavBar from '@/components/LandingNavBar';
import LandingHero from '@/components/LandingHero';
import ValueProps from '@/components/ValueProps';
import SocialProof from '@/components/SocialProof';
import HowItWorks from '@/components/HowItWorks';
import LandingCTA from '@/components/LandingCTA';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Visual Regression Testing Without a Test Suite — AIDQA',
  description:
    'Automated visual regression testing for any URL. No Playwright, no CI setup. Pixel-perfect diffs + AI analysis. Free tier available.',
  keywords: [
    'visual regression testing',
    'automated visual testing',
    'percy alternative',
    'chromatic alternative',
    'screenshot testing tool',
  ],
};

const CTA_HREF =
  'https://app.aidesignqa.com/signup?utm_source=lp&utm_campaign=visual-regression';

const VALUE_PROPS = [
  'Pixel-precise diff via pixelmatch — zero false positives from anti-aliasing',
  'CSS diff engine detects computed style mutations alongside visual changes',
  'Configurable drift threshold and ignore regions per monitor',
];

const COMPARISON = [
  { feature: 'No CI setup required', aidqa: true, percy: false, chromatic: false, playwright: false },
  { feature: 'AI change explanation', aidqa: true, percy: false, chromatic: false, playwright: false },
  { feature: 'CSS-level diffs', aidqa: true, percy: false, chromatic: false, playwright: false },
  { feature: 'Requires codebase access', aidqa: false, percy: true, chromatic: true, playwright: true },
  { feature: 'Free tier', aidqa: true, percy: 'Limited', chromatic: 'Limited', playwright: 'Self-host' },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="font-semibold text-[hsl(142,70%,40%)]">Yes</span>;
  if (value === false) return <span className="text-gray-400">No</span>;
  return <span className="text-gray-500">{value}</span>;
}

export default function VisualRegressionPage() {
  return (
    <>
      <LandingNavBar />
      <main>
        <LandingHero
          badge="Visual Regression Testing"
          headline="Visual regression testing without the test suite."
          subheadline="AIDQA runs automated visual regression checks on any URL — no Playwright setup, no CI pipeline required. Approve a baseline and let it monitor continuously."
          ctaText="Start visual regression monitoring"
          ctaHref={CTA_HREF}
        />
        <ValueProps items={VALUE_PROPS} />

        {/* Comparison table */}
        <section className="bg-[hsl(215,28%,97%)] py-20">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-gray-900">
              How AIDQA compares
            </h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-6 py-4 font-semibold text-gray-700">Feature</th>
                    <th className="px-6 py-4 font-semibold text-[hsl(243,75%,59%)]">AIDQA</th>
                    <th className="px-6 py-4 font-semibold text-gray-500">Percy</th>
                    <th className="px-6 py-4 font-semibold text-gray-500">Chromatic</th>
                    <th className="px-6 py-4 font-semibold text-gray-500">Playwright VRT</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-4 text-gray-700">{row.feature}</td>
                      <td className="px-6 py-4"><Cell value={row.aidqa} /></td>
                      <td className="px-6 py-4"><Cell value={row.percy} /></td>
                      <td className="px-6 py-4"><Cell value={row.chromatic} /></td>
                      <td className="px-6 py-4"><Cell value={row.playwright} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <SocialProof />
        <HowItWorks />
        <LandingCTA
          headline="Stop writing visual tests. Start monitoring visually."
          ctaText="Start visual regression monitoring"
          ctaHref={CTA_HREF}
        />
      </main>
      <Footer />
    </>
  );
}
