import type { Metadata } from 'next';
import LandingNavBar from '@/components/LandingNavBar';
import LandingHero from '@/components/LandingHero';
import ValueProps from '@/components/ValueProps';
import SocialProof from '@/components/SocialProof';
import HowItWorks from '@/components/HowItWorks';
import LandingCTA from '@/components/LandingCTA';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'AI UI Checker — AIDQA',
  description:
    'Stop manually checking screenshots. AIDQA automatically detects visual changes and explains them in plain English.',
};

const CTA_HREF = 'https://app.aidesignqa.com/signup?utm_source=lp&utm_campaign=ai-ui-checker';

const VALUE_PROPS = [
  'Catch regressions in production before users notice them',
  'AI explains every visual change, not just a percentage',
  'Works on any website — no integration, no code changes required',
];

export default function AiUiCheckerPage() {
  return (
    <>
      <LandingNavBar />
      <main>
        <LandingHero
          badge="AI UI Checker"
          headline="Your AI UI checker that never sleeps."
          subheadline="Stop manually clicking through your app after every deploy. AIDQA automatically checks for visual changes and tells you what broke — in plain English."
          ctaText="Check my UI for free"
          ctaHref={CTA_HREF}
        />
        <ValueProps items={VALUE_PROPS} />
        <SocialProof />
        <HowItWorks />
        <LandingCTA
          headline="Ready to stop eyeballing your UI after every deploy?"
          ctaText="Check my UI for free"
          ctaHref={CTA_HREF}
        />
      </main>
      <Footer />
    </>
  );
}
