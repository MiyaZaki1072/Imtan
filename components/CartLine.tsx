'use client';

import { formatBaht } from '@/lib/format';
import { MAX_QTY } from '@/lib/menu';
import { TrashIcon } from './icons';
import { Stepper } from './Stepper';
import { card, cx } from './ui';

export function CartLine({
  summary,
  note,
  qty,
  lineTotalSatang,
  problem,
  onQty,
  onRemove,
}: {
  summary: string;
  note: string;
  qty: number;
  lineTotalSatang: number | null;
  /** Shown when the line can no longer be ordered (sold out, price changed shape). */
  problem: string | null;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className={cx(card, 'px-4 py-3.5', problem && 'border-danger/50')}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-semibold">{summary}</p>
        <button
          type="button"
          aria-label="ลบรายการนี้"
          onClick={onRemove}
          className="-mt-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-danger"
        >
          <TrashIcon size={20} />
        </button>
      </div>
      {note && <p className="mt-1 text-sm text-muted">หมายเหตุ: {note}</p>}
      {problem && <p className="mt-1 text-sm font-semibold text-danger">{problem}</p>}
      <div className="mt-3 flex items-center justify-between">
        <Stepper value={qty} onChange={onQty} max={MAX_QTY} label="จำนวนจาน" />
        <p className="text-lg font-bold">
          {lineTotalSatang === null ? '–' : formatBaht(lineTotalSatang)}
        </p>
      </div>
    </li>
  );
}
