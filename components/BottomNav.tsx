'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, QrIcon, TicketIcon } from './icons';
import { cx } from './ui';

const ITEMS = [
  { href: '/', label: 'หน้าแรก', Icon: HomeIcon, match: (p: string) => p === '/' },
  { href: '/scan', label: 'สแกน QR', Icon: QrIcon, match: (p: string) => p.startsWith('/scan') },
  {
    href: '/orders',
    label: 'คิวของฉัน',
    Icon: TicketIcon,
    match: (p: string) => p.startsWith('/orders'),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-[430px] grid-cols-3">
        {ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm',
                  active ? 'font-semibold text-primary' : 'text-muted',
                )}
              >
                <Icon size={22} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
