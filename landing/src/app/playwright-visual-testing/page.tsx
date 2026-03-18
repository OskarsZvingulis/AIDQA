import type { Metadata } from 'next';
import LandingNavBar from '@/components/LandingNavBar';
import LandingHero from '@/components/LandingHero';
import ValueProps from '@/components/ValueProps';
import HowItWorks from '@/components/HowItWorks';
import LandingCTA from '@/components/LandingCTA';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Visual Testing Without Playwright Setup | AIDQA',
  description:
    'Playwright visual testing requires writing tests, maintaining snapshots, and running a CI pipeline. AIDQA gives you design quality findings on any interface — no test code, no snapshot directory, no CI required.',
  keywords: [
    'playwright visual testing',
    'playwright visual regression',
    'visual testing without playwright',
    'ui visual testing tool',
    'design qa without test suite',
  ],
};

const CTA_HREF = 'https://app.aidesignqa.com/signup?utm_source=lp&utm_campaign=playwright-vt';

const VALUE_PROPS = [
  'No test code — paste a URL or screenshot, get prioritized findings in under 60 seconds',
  'No snapshot directory to maintain — AIDQA checks internal consistency rules, not pixel diffs',
  'No CI pipeline — works standalone for any interface, on any project stage',
  'Catches design issues Playwright VRT misses: spacing rhythm, heading hierarchy, component drift',
];

export default function PlaywrightVisualTestingPage() {
  return (
    <>
      <LandingNavBar />
      <main>
        <LandingHero
          badge="Playwright Visual Testing"
          headline="Design quality checks without a Playwright test suite"
          subheadline="Playwright's visual comparison feature compares screenshots against stored snapshots and flags pixel differences. It's powerful for regression detection in established codebases. But it requires writing tests, managing snapshot files, and running a CI pipeline. AIDQA is the tool for teams who need design quality feedback without any of that setup."
          ctaText="Run your first scan free"
          ctaHref={CTA_HREF}
        />
        <ValueProps items={VALUE_PROPS} />

        <section className="py-20 bg-[hsl(215,28%,97%)]">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="mb-6 text-2xl font-bold tracking-tight text-gray-900">
              Playwright VRT vs AIDQA
            </h2>
            <p className="mb-10 text-gray-600">
              Both tools catch visual regressions — but they work at different layers and require different setup.
            </p>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-gray-900">Playwright VRT</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>✓ Pixel-perfect snapshot comparison</li>
                  <li>✓ Integrates with existing test suites</li>
                  <li>✓ CI/CD native</li>
                  <li>✗ Requires test code and snapshot management</li>
                  <li>✗ Needs a baseline before it can flag anything</li>
                  <li>✗ Flags pixel differences, not design quality issues</li>
                  <li>✗ No accessibility or design rule checks</li>
                </ul>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
                <h3 className="mb-4 font-semibold text-indigo-900">AIDQA</h3>
                <ul className="space-y-2 text-sm text-indigo-800">
                  <li>✓ No test code or snapshot management</li>
                  <li>✓ Works on any URL or screenshot, day one</li>
                  <li>✓ Checks design quality rules, not pixels</li>
                  <li>✓ WCAG AA contrast and touch target checks</li>
                  <li>✓ Repair guidance per finding</li>
                  <li>✗ Not a CI-integrated regression runner</li>
                  <li>✗ No code-level diff tracking</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <HowItWorks />
        <LandingCTA
          headline="Design quality checks. No test suite required."
          ctaText="Run your first scan free"
          ctaHref={CTA_HREF}
        />
      </main>
      <Footer />
    </>
  );
}
