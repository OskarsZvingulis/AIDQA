export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white py-10">
      <div className="mx-auto max-w-6xl px-6 text-center text-sm text-gray-400">
        <p>
          <a href="https://aidesignqa.com" className="font-semibold text-gray-900 hover:underline">
            AIDQA
          </a>
          {' '}— Automated visual regression testing.
        </p>
        <nav className="mt-4 flex justify-center gap-6 text-xs">
          <a href="https://aidesignqa.com" className="hover:text-gray-700 transition-colors">Home</a>
          <a href="https://aidesignqa.com/how-it-works" className="hover:text-gray-700 transition-colors">How it works</a>
          <a href="https://aidesignqa.com/pricing" className="hover:text-gray-700 transition-colors">Pricing</a>
          <a href="https://app.aidesignqa.com/signup" className="hover:text-gray-700 transition-colors">Sign up</a>
        </nav>
      </div>
    </footer>
  );
}
