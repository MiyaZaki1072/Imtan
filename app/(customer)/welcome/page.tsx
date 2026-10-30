import { Suspense } from 'react';
import { WelcomeForm } from './WelcomeForm';

export default function WelcomePage() {
  return (
    <main className="flex-1 px-4 pt-10 pb-8">
      <h1 className="text-3xl font-bold text-primary">อิ่มทัน</h1>
      <p className="mt-2 text-lg font-semibold">ดูคิวทุกร้าน สั่งล่วงหน้า แล้วไปนั่งรอได้เลย</p>
      <p className="mt-1 text-sm text-muted">
        โรงอาหารคณะวิศวกรรมศาสตร์ จุฬาฯ · ระบบจะแจ้งเตือนเมื่ออาหารพร้อม
      </p>
      <Suspense>
        <WelcomeForm />
      </Suspense>
    </main>
  );
}
