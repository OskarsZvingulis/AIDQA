import type { Metadata } from 'next';
import LandingNavBar from '@/components/LandingNavBar';
import LandingHero from '@/components/LandingHero';
import ValueProps from '@/components/ValueProps';
import SocialProof from '@/components/SocialProof';
import HowItWorks from '@/components/HowItWorks';
import LandingCTA from '@/components/LandingCTA';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Design QA Automation — AIDQA',
  description:
    'Automatically catch the gap between your Figma designs and what ships to production.',
};

const CTA_HREF = 'https://app.aidesignqa.com/signup?utm_source=lp&utm_campaign=design-qa';

const VALUE_PROPS = [
  'Spot when developer changes diverge from your approved design',
  'Pixel-level diffs and CSS property changes, not just "something looks wrong"',
  'No plugins, no Figma integrations — just a URL',
];

export default function DesignQaPage() {
  return (
    <>
      <LandingNavBar />
      <main>
        <LandingHero
          badge="Design QA"
          headline="Your design ships exactly as intended. Every time."
          subheadline="AIDQA catches the gap between your Figma specs and what actually goes live — automatically, on every deploy."
          ctaText="Protect your designs"
          ctaHref={CTA_HREF}
        />
        <ValueProps items={VALUE_PROPS} />
        <SocialProof />
        <HowItWorks />
        <LandingCTA
          headline="Make sure your designs actually ship the way you designed them."
          ctaText="Protect your designs"
          ctaHref={CTA_HREF}
        />
      </main>
      <Footer />
    </>
  );
}
