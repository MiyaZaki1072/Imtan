import Link from 'next/link';
import { signOut } from '@/app/login/actions';
import { getSession, vendorPageShopSlug } from '@/lib/auth';
import { getShop } from '@/lib/demo-data/load';

// Vendor screens target a 1024 px tablet and still work on a phone.
const NAV = [
  { href: '/vendor', label: 'กระดานออเดอร์' },
  { href: '/vendor/stock', label: 'ของหมด' },
  { href: '/vendor/menu', label: 'เมนู/ราคา' },
  { href: '/vendor/settings', label: 'ตั้งค่าร้าน' },
];

const navLink =
  'inline-flex min-h-12 items-center rounded-lg px-3 text-sm font-semibold text-muted hover:bg-bg hover:text-ink';

/** Header for the signed-in vendor's shop. Redirects to /login when not a vendor or admin. */
export async function VendorShell({ children }: { children: React.ReactNode }) {
  const slug = await vendorPageShopSlug();
  const session = await getSession();
  const shop = getShop(slug);
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <p className="mr-auto py-2">
            <span className="text-xl font-bold">{shop?.name}</span>
            <span className="ml-2 text-sm font-semibold text-primary">
              อิ่มทัน สำหรับร้านค้า{session?.role === 'admin' && ' · ผู้ดูแล'}
            </span>
          </p>
          <nav aria-label="เมนูร้านค้า" className="-mx-2 flex flex-wrap">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={navLink}>
                {n.label}
              </Link>
            ))}
            <form action={signOut}>
              <button type="submit" className={navLink}>
                ออกจากระบบ
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
