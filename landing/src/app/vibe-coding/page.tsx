import type { Metadata } from 'next';
import LandingNavBar from '@/components/LandingNavBar';
import LandingHero from '@/components/LandingHero';
import ValueProps from '@/components/ValueProps';
import SocialProof from '@/components/SocialProof';
import HowItWorks from '@/components/HowItWorks';
import LandingCTA from '@/components/LandingCTA';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Visual QA for Vibe Coders — AIDQA',
  description:
    "When you're shipping at cursor speed, visual regressions happen constantly. AIDQA catches them automatically.",
};

const CTA_HREF = 'https://app.aidesignqa.com/signup?utm_source=lp&utm_campaign=vibe-coding';

const VALUE_PROPS = [
  "Catches the subtle layout breaks Claude and Copilot don't tell you about",
  'Works on any URL — ship your app, paste the URL, done',
  'GPT-4o Vision explains the diff in plain English, like a second pair of eyes',
];

export default function VibeCodingPage() {
  return (
    <>
      <LandingNavBar />
      <main>
        <LandingHero
          badge="For vibe coders"
          headline="AI wrote your frontend. AI should check it too."
          subheadline="When you're shipping at cursor speed, visual regressions happen constantly. AIDQA watches your UI so you don't have to manually check screenshots after every commit."
          ctaText="Add it to my vibe stack"
          ctaHref={CTA_HREF}
        />
        <ValueProps items={VALUE_PROPS} />
        <SocialProof />
        <HowItWorks />
        <LandingCTA
          headline="Ship fast. Let AIDQA watch the pixels."
          ctaText="Add it to my vibe stack"
          ctaHref={CTA_HREF}
        />
      </main>
      <Footer />
    </>
  );
}
