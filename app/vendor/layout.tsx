import Link from 'next/link';
import { getShop } from '@/lib/demo-data/load';
import { SAMPLE_VENDOR_SHOP } from '@/lib/sample';

// Vendor screens target a 1024 px tablet and still work on a phone.
// Phase 2: the signed-in vendor's shop comes from requireVendor(); Phase 1 shows a sample shop.
const NAV = [
  { href: '/vendor', label: 'กระดานออเดอร์' },
  { href: '/vendor/stock', label: 'ของหมด' },
  { href: '/vendor/menu', label: 'เมนู/ราคา' },
  { href: '/vendor/settings', label: 'ตั้งค่าร้าน' },
];

export default function VendorLayout({ children }: LayoutProps<'/vendor'>) {
  const shop = getShop(SAMPLE_VENDOR_SHOP);
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <p className="mr-auto py-2">
            <span className="text-xl font-bold">{shop?.name}</span>
            <span className="ml-2 text-sm font-semibold text-primary">อิ่มทัน สำหรับร้านค้า</span>
          </p>
          <nav aria-label="เมนูร้านค้า" className="-mx-2 flex flex-wrap">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="inline-flex min-h-12 items-center rounded-lg px-3 text-sm font-semibold text-muted hover:bg-bg hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
