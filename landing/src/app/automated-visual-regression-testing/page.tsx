import type { Metadata } from 'next';
import LandingNavBar from '@/components/LandingNavBar';
import LandingHero from '@/components/LandingHero';
import ValueProps from '@/components/ValueProps';
import HowItWorks from '@/components/HowItWorks';
import LandingCTA from '@/components/LandingCTA';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Automated Visual Regression Testing Without a Baseline | AIDQA',
  description:
    'Traditional automated visual regression testing requires a stored baseline to compare against. AIDQA detects design quality regressions on any interface — no CI setup, no baseline, no snapshot management.',
  keywords: [
    'automated visual regression testing',
    'visual regression testing without baseline',
    'automated ui testing',
    'design regression detection',
    'ai ui quality check',
  ],
};

const CTA_HREF = 'https://app.aidesignqa.com/signup?utm_source=lp&utm_campaign=automated-vrt';

const VALUE_PROPS = [
  'No CI pipeline required — paste a URL or screenshot and get results in under 60 seconds',
  'Detects spacing drift, component inconsistency, alignment failures, and heading scale regressions',
  'Catches accessibility regressions: contrast failures below WCAG AA, touch targets below 44×44px',
  'Works on any interface — no codebase access, no test runner, no snapshot directory to manage',
];

export default function AutomatedVisualRegressionPage() {
  return (
    <>
      <LandingNavBar />
      <main>
        <LandingHero
          badge="Automated Visual Regression Testing"
          headline="Automated visual regression testing that needs no baseline"
          subheadline="Most automated visual regression tools — Percy, Chromatic, Playwright VRT — compare screenshots against a stored reference. That means you need an approved baseline, a CI pipeline, and a codebase to integrate with. AIDQA takes a different approach: it measures internal design consistency, accessibility thresholds, and layout rules on any interface, on day one of a project."
          ctaText="Run your first scan free"
          ctaHref={CTA_HREF}
        />
        <ValueProps items={VALUE_PROPS} />
        <HowItWorks />
        <LandingCTA
          headline="Catch design regressions without writing a single test."
          ctaText="Run your first scan free"
          ctaHref={CTA_HREF}
        />
      </main>
      <Footer />
    </>
  );
}
