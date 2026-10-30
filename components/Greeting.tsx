'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

/** "สวัสดี <name>" from the local session. Tapping it opens /welcome to rename. */
export function Greeting() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      const n = data.session?.user.user_metadata?.display_name;
      if (active && typeof n === 'string') setName(n);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!name) return null;
  return (
    <Link
      href="/welcome"
      aria-label={`สวัสดี ${name} · เปลี่ยนชื่อ`}
      className="mt-1 inline-flex min-h-11 max-w-40 items-center truncate rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary-hover"
    >
      สวัสดี {name}
    </Link>
  );
}
