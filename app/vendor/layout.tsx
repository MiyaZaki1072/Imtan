import { Suspense } from 'react';
import { VendorShell } from './VendorShell';

export default function VendorLayout({ children }: LayoutProps<'/vendor'>) {
  return (
    <Suspense fallback={<p className="px-4 pt-10 text-center text-muted">กำลังโหลด…</p>}>
      <VendorShell>{children}</VendorShell>
    </Suspense>
  );
}
