import Link from 'next/link';
import { btnPrimary } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">ไม่พบหน้านี้</h1>
      <p className="mt-2 text-muted">ลิงก์อาจผิด หรือหน้านี้ไม่มีแล้ว</p>
      <Link href="/" className={`${btnPrimary} mt-6 min-h-12`}>
        กลับหน้าแรก
      </Link>
    </main>
  );
}
