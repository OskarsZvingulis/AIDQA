const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.aidesignqa.com';

export default function LandingNavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="https://aidesignqa.com" className="text-lg font-bold tracking-tight text-gray-900">
          AIDQA
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 sm:flex">
          <a href="https://aidesignqa.com/how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
          <a href="https://aidesignqa.com/pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
        </nav>
        <a
          href={`${APP_URL}/signup`}
          className="rounded-lg bg-[hsl(243,75%,59%)] px-4 py-2 text-sm font-semibold text-white hover:bg-[hsl(243,68%,48%)] transition-colors"
        >
          Get started free
        </a>
      </div>
    </header>
  );
}
