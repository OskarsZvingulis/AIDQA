import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aidesignqa.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Design Intelligence Layer for AI Builders | AIDQA',
  description: 'AIDQA scans AI-generated UI for objective design issues — spacing drift, broken hierarchy, contrast failures, component inconsistency. Get prioritized findings with repair guidance in under 60 seconds.',
  openGraph: {
    title: 'Design Intelligence Layer for AI Builders | AIDQA',
    description: 'Catch measurable design issues in your AI-generated UI before users do. No baseline required.',
    url: siteUrl,
    siteName: 'AIDQA',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'AIDQA — Design Intelligence Layer for AI Builders' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Design Intelligence Layer for AI Builders | AIDQA',
    description: 'Catch measurable design issues in your AI-generated UI before users do.',
    images: ['/og.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AIDQA',
  applicationCategory: 'DeveloperApplication',
  description: 'Automated design quality analysis for AI-generated interfaces. Detects spacing drift, hierarchy issues, contrast failures, and component inconsistency.',
  url: siteUrl,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free scan included',
  },
  operatingSystem: 'Web',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Prevent dark/light mode flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[var(--background)] text-[var(--foreground)]`}>
        {children}
      </body>
    </html>
  );
}
