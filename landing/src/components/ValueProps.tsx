import { Check } from 'lucide-react';

interface ValuePropsProps {
  items: string[];
}

export default function ValueProps({ items }: ValuePropsProps) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-3xl px-6">
        <ul className="space-y-5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(142,70%,45%)]">
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </span>
              <span className="text-base text-gray-700">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
