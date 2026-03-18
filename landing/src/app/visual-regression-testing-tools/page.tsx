import type { Metadata } from 'next';
import LandingNavBar from '@/components/LandingNavBar';
import LandingHero from '@/components/LandingHero';
import ValueProps from '@/components/ValueProps';
import LandingCTA from '@/components/LandingCTA';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Visual Regression Testing Tools Compared (2026) | AIDQA',
  description:
    'Compare the top visual regression testing tools: Percy, Chromatic, Playwright VRT, Applitools, and AIDQA. Find the right tool for your workflow — from CI-integrated snapshot testing to baseline-free design QA.',
  keywords: [
    'visual regression testing tools',
    'visual testing tools comparison',
    'percy alternative',
    'chromatic alternative',
    'visual regression tools 2026',
  ],
};

const CTA_HREF = 'https://app.aidesignqa.com/signup?utm_source=lp&utm_campaign=vrt-tools';

const tools = [
  {
    name: 'AIDQA',
    type: 'Design Intelligence Layer',
    baseline: 'Not required',
    ciRequired: 'No',
    designChecks: 'Yes — spacing, hierarchy, contrast, alignment',
    accessibility: 'Yes — WCAG AA contrast + touch targets',
    bestFor: 'AI-generated UI, fast-shipping teams, no-code builders',
    highlight: true,
  },
  {
    name: 'Percy (BrowserStack)',
    type: 'Visual snapshot testing',
    baseline: 'Required',
    ciRequired: 'Yes',
    designChecks: 'No',
    accessibility: 'No',
    bestFor: 'Component libraries with CI pipelines',
    highlight: false,
  },
  {
    name: 'Chromatic',
    type: 'Storybook visual testing',
    baseline: 'Required',
    ciRequired: 'Yes (Storybook)',
    designChecks: 'No',
    accessibility: 'Partial (via addon)',
    bestFor: 'Storybook-based design systems',
    highlight: false,
  },
  {
    name: 'Playwright VRT',
    type: 'Screenshot diff testing',
    baseline: 'Required',
    ciRequired: 'Yes',
    designChecks: 'No',
    accessibility: 'No',
    bestFor: 'Teams with existing Playwright test suites',
    highlight: false,
  },
  {
    name: 'Applitools',
    type: 'AI visual testing',
    baseline: 'Required',
    ciRequired: 'Yes',
    designChecks: 'Partial',
    accessibility: 'Partial',
    bestFor: 'Enterprise QA teams with large test suites',
    highlight: false,
  },
];

const VALUE_PROPS = [
  'No baseline or approved snapshot required — works on day one of any project',
  'No CI pipeline or codebase integration — paste a URL or drop a screenshot',
  'Checks design quality rules, not just pixel differences',
  'Returns actionable findings with repair guidance, not just red/green diffs',
];

export default function VisualRegressionToolsPage() {
  return (
    <>
      <LandingNavBar />
      <main>
        <LandingHero
          badge="Visual Regression Testing Tools"
          headline="Visual regression testing tools compared (2026)"
          subheadline="The best visual regression testing tool depends on your workflow. If you have a CI pipeline and a Storybook, Percy or Chromatic make sense. If you're shipping AI-generated UI and need design quality checks without any setup, AIDQA is the tool built for that gap."
          ctaText="Try AIDQA free"
          ctaHref={CTA_HREF}
        />

        <section className="py-20 bg-[hsl(215,28%,97%)]">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-gray-900">
              Tool comparison
            </h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-4 font-semibold text-gray-700">Tool</th>
                    <th className="px-4 py-4 font-semibold text-gray-700">Baseline needed</th>
                    <th className="px-4 py-4 font-semibold text-gray-700">CI required</th>
                    <th className="px-4 py-4 font-semibold text-gray-700">Design checks</th>
                    <th className="px-4 py-4 font-semibold text-gray-700">Accessibility</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((tool) => (
                    <tr
                      key={tool.name}
                      className={`border-b border-gray-50 last:border-0 ${tool.highlight ? 'bg-indigo-50' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <span className={`font-semibold ${tool.highlight ? 'text-indigo-700' : 'text-gray-700'}`}>
                          {tool.name}
                        </span>
                        <br />
                        <span className="text-xs text-gray-400">{tool.type}</span>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{tool.baseline}</td>
                      <td className="px-4 py-4 text-gray-600">{tool.ciRequired}</td>
                      <td className="px-4 py-4 text-gray-600">{tool.designChecks}</td>
                      <td className="px-4 py-4 text-gray-600">{tool.accessibility}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <ValueProps items={VALUE_PROPS} />
        <LandingCTA
          headline="No CI. No baseline. Just design quality findings."
          ctaText="Try AIDQA free"
          ctaHref={CTA_HREF}
        />
      </main>
      <Footer />
    </>
  );
}
