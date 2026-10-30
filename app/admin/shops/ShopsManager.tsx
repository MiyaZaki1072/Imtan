'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btnPrimary, btnSecondary, card, cx, input, label } from '@/components/ui';
import { actCreateShop, actResetVendorPassword, actSelectShop } from '@/lib/admin/actions';

interface ShopRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  queuePrefix: string;
  isOpen: boolean;
  hasAccount: boolean;
}

const ERRORS: Record<string, string> = {
  bad_input: 'ข้อมูลไม่ถูกต้อง ตรวจชื่อ ตัวย่อรหัสร้าน (a-z, 0-9, -) และเวลาต่อจาน',
  duplicate: 'มีร้านหรือบัญชีที่ใช้รหัสร้านนี้แล้ว',
  no_password: 'ยังไม่ได้ตั้ง VENDOR_LOGIN_PASSWORD บนเซิร์ฟเวอร์',
  not_found: 'ไม่พบร้านนี้',
  failed: 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง',
};

export function ShopsManager({ shops }: { shops: ShopRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    slug: '',
    name: '',
    category: '',
    queuePrefix: '',
    minutes: '2',
  });
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy('create');
    const r = await actCreateShop({
      slug: form.slug,
      name: form.name,
      category: form.category,
      queuePrefix: form.queuePrefix,
      manualSecondsPerItem: Math.round(Number(form.minutes) * 60),
    }).catch(() => null);
    setBusy(null);
    if (r?.ok) {
      setMessage({
        ok: true,
        text: `สร้างร้านแล้ว · ชื่อผู้ใช้ ${r.username} · ใช้ปุ่มเลือกร้านที่หน้า /login ได้ทันที · กด "แก้ไขร้านนี้" เพื่อสร้างเมนู`,
      });
      setForm({ slug: '', name: '', category: '', queuePrefix: '', minutes: '2' });
      router.refresh();
    } else setMessage({ ok: false, text: ERRORS[r?.error ?? 'failed'] });
  }

  async function reset(shop: ShopRow, custom: boolean) {
    setBusy(shop.id);
    const pw = custom ? passwords[shop.id] : undefined;
    const r = await actResetVendorPassword(shop.id, pw).catch(() => null);
    setBusy(null);
    if (r?.ok) {
      setMessage({
        ok: true,
        text: r.shared
          ? `รีเซ็ต ${shop.name} กลับเป็นรหัสผ่านกลางแล้ว (ปุ่มเลือกร้านใช้ได้)`
          : `ตั้งรหัสผ่านใหม่ให้ ${shop.name} แล้ว · เข้าสู่ระบบด้วยชื่อผู้ใช้ ${r.username} + รหัสผ่านนี้ (ปุ่มเลือกร้านจะใช้ไม่ได้ จนกว่าจะรีเซ็ตกลับ)`,
      });
      setPasswords((p) => ({ ...p, [shop.id]: '' }));
      router.refresh();
    } else
      setMessage({
        ok: false,
        text:
          ERRORS[r?.error ?? 'failed'] +
          (r?.error === 'bad_input' ? ' (รหัสผ่านอย่างน้อย 6 ตัวอักษร)' : ''),
      });
  }

  async function edit(shop: ShopRow, to: string) {
    setBusy(shop.id);
    const r = await actSelectShop(shop.slug).catch(() => null);
    // Full page load so the vendor screens show the chosen shop, not a cached one.
    if (r?.ok) window.location.assign(to);
    else {
      setBusy(null);
      setMessage({ ok: false, text: ERRORS.failed });
    }
  }

  return (
    <>
      <form
        onSubmit={create}
        className={cx(card, 'mt-4 grid gap-3 px-4 py-4 sm:grid-cols-2')}
        aria-label="สร้างร้านใหม่"
      >
        <h2 className="text-lg font-bold sm:col-span-2">สร้างร้านใหม่ + บัญชีร้านค้า</h2>
        <div>
          <label className={label} htmlFor="n-name">
            ชื่อร้าน
          </label>
          <input
            id="n-name"
            className={input}
            value={form.name}
            maxLength={80}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="n-cat">
            ประเภทร้าน
          </label>
          <input
            id="n-cat"
            className={input}
            value={form.category}
            maxLength={80}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="n-slug">
            รหัสร้าน (a-z, 0-9, -) = ชื่อผู้ใช้
          </label>
          <input
            id="n-slug"
            className={input}
            value={form.slug}
            maxLength={30}
            autoCapitalize="none"
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="n-prefix">
              ตัวนำหน้าคิว
            </label>
            <input
              id="n-prefix"
              className={input}
              value={form.queuePrefix}
              maxLength={8}
              onChange={(e) => setForm({ ...form, queuePrefix: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor="n-min">
              นาทีต่อจาน
            </label>
            <input
              id="n-min"
              className={input}
              inputMode="decimal"
              value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: e.target.value })}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={
            busy === 'create' || !form.slug || !form.name || !form.category || !form.queuePrefix
          }
          className={cx(btnPrimary, 'min-h-12 sm:col-span-2')}
        >
          {busy === 'create' ? 'กำลังสร้าง…' : 'สร้างร้านและบัญชี'}
        </button>
      </form>

      <p
        role="status"
        className={cx(
          'mt-3 min-h-6 text-sm font-semibold',
          message?.ok === false ? 'text-danger' : 'text-success',
        )}
      >
        {message?.text}
      </p>

      <ul className="mt-2 space-y-3" aria-label="รายชื่อร้าน">
        {shops.map((s) => (
          <li key={s.id} className={cx(card, 'px-4 py-4')}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold">{s.name}</h3>
                <p className="text-sm text-muted">
                  {s.category} · คิว {s.queuePrefix}-N ·{' '}
                  {s.isOpen ? 'เปิดรับออเดอร์' : 'ปิดรับชั่วคราว'}
                </p>
                <p className="mt-0.5 text-sm">
                  ชื่อผู้ใช้ <span className="font-mono font-semibold">{s.slug}</span>{' '}
                  <span className={s.hasAccount ? 'text-success' : 'text-danger'}>
                    {s.hasAccount ? '· มีบัญชี' : '· ยังไม่มีบัญชี'}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => edit(s, '/vendor/menu')}
                  className={cx(btnPrimary, 'min-h-12')}
                >
                  แก้ไขร้านนี้ (เมนู/ราคา)
                </button>
                <button
                  type="button"
                  disabled={busy === s.id}
                  onClick={() => edit(s, '/vendor')}
                  className={cx(btnSecondary, 'min-h-12')}
                >
                  กระดานออเดอร์
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <button
                type="button"
                disabled={busy === s.id}
                onClick={() => reset(s, false)}
                className={cx(btnSecondary, 'min-h-12')}
              >
                {s.hasAccount ? 'รีเซ็ตเป็นรหัสผ่านกลาง' : 'สร้างบัญชีร้าน'}
              </button>
              <input
                aria-label={`รหัสผ่านใหม่ของ ${s.name}`}
                placeholder="หรือตั้งรหัสผ่านเอง (6+ ตัว)"
                type="password"
                autoComplete="new-password"
                className={cx(input, 'max-w-64')}
                value={passwords[s.id] ?? ''}
                onChange={(e) => setPasswords((p) => ({ ...p, [s.id]: e.target.value }))}
              />
              <button
                type="button"
                disabled={busy === s.id || (passwords[s.id] ?? '').length < 6}
                onClick={() => reset(s, true)}
                className={cx(btnSecondary, 'min-h-12 disabled:opacity-40')}
              >
                ตั้งรหัสผ่านนี้
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
