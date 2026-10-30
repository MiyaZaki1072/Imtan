'use client';

import { useState } from 'react';
import { DemoBanner } from '@/components/DemoBanner';
import { DemoControls } from './DemoControls';

interface ShopOption {
  id: string;
  slug: string;
  name: string;
  autoAdvance: boolean;
}

/** One screen for the talk: controls, a 390 px phone frame (customer) and the vendor board. */
export function DemoView({ shops, currentSlug }: { shops: ShopOption[]; currentSlug: string }) {
  // Bumping the key reloads both frames (after a shop change or a reset).
  const [frameKey, setFrameKey] = useState(0);
  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-4 xl:flex-row">
      <aside className="space-y-3 xl:w-80 xl:shrink-0">
        <h1 className="text-2xl font-bold">โหมดนำเสนอ</h1>
        <DemoBanner />
        <DemoControls
          shops={shops}
          currentSlug={currentSlug}
          onShopChange={() => setFrameKey((k) => k + 1)}
        />
      </aside>

      <section aria-label="มือถือลูกค้า" className="flex justify-center xl:shrink-0">
        <div className="rounded-[2.75rem] border-[10px] border-ink bg-ink shadow-xl">
          <iframe
            key={`phone-${frameKey}`}
            src="/"
            title="แอปลูกค้า"
            className="h-[760px] w-[390px] max-w-[calc(100vw-3.5rem)] rounded-[2rem] bg-bg"
          />
        </div>
      </section>

      <section
        aria-label="กระดานแม่ค้า"
        className="min-h-[760px] flex-1 overflow-hidden rounded-2xl border border-border"
      >
        <iframe
          key={`vendor-${frameKey}`}
          src="/vendor"
          title="กระดานแม่ค้า"
          className="h-full min-h-[760px] w-full bg-bg"
        />
      </section>
    </main>
  );
}
