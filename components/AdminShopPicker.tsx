'use client';

import { useState } from 'react';
import { actSelectShop } from '@/lib/admin/actions';

/** Admins pick which shop the vendor screens show; the same editors then work on that shop. */
export function AdminShopPicker({
  shops,
  current,
}: {
  shops: { slug: string; name: string }[];
  current: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-semibold text-muted">ร้าน</span>
      <select
        aria-label="เลือกร้านที่จะดู"
        disabled={busy}
        value={current}
        onChange={async (e) => {
          setBusy(true);
          await actSelectShop(e.target.value).catch(() => null);
          // A full reload: the client router would keep showing the previous shop's cached screens.
          window.location.reload();
        }}
        className="min-h-12 max-w-52 rounded-xl border border-border bg-surface px-2"
      >
        {shops.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
