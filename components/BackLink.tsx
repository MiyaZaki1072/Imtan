import Link from 'next/link';
import { ChevronLeftIcon } from './icons';

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 px-2 text-sm font-semibold text-primary"
    >
      <ChevronLeftIcon size={18} />
      {children}
    </Link>
  );
}
