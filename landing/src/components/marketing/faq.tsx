"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

export function FAQ() {
  const faqs = [
    {
      question: "Does AIDQA require a design system or Figma file to work?",
      answer: "No. AIDQA runs checks against internal consistency and design rules without needing a baseline or token file. You can optionally provide a Tailwind config or token set to enable design-system compliance checks.",
    },
    {
      question: "How is this different from a visual regression testing tool?",
      answer: "Visual regression tools like Percy or Chromatic compare screenshots against a known baseline and flag pixel differences. AIDQA doesn't need a baseline — it inspects a single interface for objective quality issues: spacing rhythm, hierarchy, consistency, and accessibility risk. You can use it on day one of a project.",
    },
    {
      question: "What inputs does AIDQA accept?",
      answer: "Screenshot uploads (PNG, JPG, WEBP up to 10MB) and public URLs. The URL scan renders a full desktop viewport and extracts DOM metadata for deeper structural analysis.",
    },
    {
      question: "Who is AIDQA for?",
      answer: "Primarily builders using AI tools to generate product UI — indie hackers, startup teams, and developers shipping fast without a dedicated design review process. Also useful for frontend engineers who want automated design QA in their pre-release workflow.",
    },
    {
      question: "How is this different from Lighthouse?",
      answer: "Lighthouse checks performance, SEO, and basic accessibility (like missing alt tags). AIDQA checks design quality signals that Lighthouse doesn't touch: spacing rhythm consistency, heading hierarchy, component drift, visual alignment, WCAG contrast ratios measured against computed CSS, and touch target sizing across interactive elements.",
    },
    {
      question: "What does a finding actually look like?",
      answer: "Each finding includes: a severity level (critical / high / medium / low), the category (layout, hierarchy, accessibility, etc.), an evidence callout showing exactly where the issue appears in the screenshot, a plain-English explanation of why it matters, repair guidance, and an AI-ready fix instruction you can paste into Cursor, v0, or Lovable.",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-[var(--card)]">
      <div className="max-w-[800px] mx-auto px-6 md:px-8">
        <h2 className="mb-12 text-center">Frequently asked questions</h2>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-[var(--border-subtle)] rounded-xl px-6 bg-[var(--background)]"
            >
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <span>{faq.question}</span>
              </AccordionTrigger>
              <AccordionContent className="text-base pb-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
