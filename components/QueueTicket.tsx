import { card, cx } from './ui';

/** Big queue label card, e.g. "บึก-27". Extra rows go in children. */
export function QueueTicket({
  shopName,
  label,
  badge,
  tone = 'plain',
  children,
}: {
  shopName: string;
  label: string;
  badge?: React.ReactNode;
  tone?: 'plain' | 'cooking';
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-label={`เลขคิว ${label}`}
      className={cx(
        card,
        'px-5 py-6 text-center',
        tone === 'cooking' && 'border-2 border-warning/60 bg-warning-soft/60',
      )}
    >
      {badge ?? <p className="text-sm text-muted">{shopName} · เลขคิวของคุณ</p>}
      <p className="mt-3 text-6xl leading-[1.35] font-bold tracking-tight text-primary">{label}</p>
      {children}
    </section>
  );
}

export function TicketStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-bg px-2 py-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-bold">{value}</p>
    </div>
  );
}
