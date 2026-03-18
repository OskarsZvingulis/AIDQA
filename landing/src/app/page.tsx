'use client';

import { Navigation } from '@/components/marketing/navigation';
import { HeroSection } from '@/components/marketing/hero-section';
import { CredibilityStrip } from '@/components/marketing/credibility-strip';
import { ProblemSection } from '@/components/marketing/problem-section';
import { SolutionSection } from '@/components/marketing/solution-section';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { UseCases } from '@/components/marketing/use-cases';
import { WhyPeoplePay } from '@/components/marketing/why-people-pay';
import { WhoItsFor } from '@/components/marketing/who-its-for';
import { DemoSection } from '@/components/marketing/demo-section';
import { PromiseSection } from '@/components/marketing/promise-section';
import { EarlyAccessForm } from '@/components/marketing/early-access-form';
import { FAQ } from '@/components/marketing/faq';
import { Footer } from '@/components/marketing/footer';
import { PricingSection } from '@/components/marketing/pricing-section';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSection />
      <CredibilityStrip />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <UseCases />
      <WhyPeoplePay />
      <WhoItsFor />
      <DemoSection />
      <PricingSection />
      <PromiseSection />
      <EarlyAccessForm />
      <FAQ />
      <Footer />
    </div>
  );
}
