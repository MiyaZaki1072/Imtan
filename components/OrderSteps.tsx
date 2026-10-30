import { CheckIcon } from './icons';
import { card, cx } from './ui';

export type OrderStepState = 'done' | 'current' | 'todo';

export interface OrderStep {
  title: string;
  detail: string;
  state: OrderStepState;
}

/** The 4 customer steps: paid → in queue → cooking → ready. */
export function OrderSteps({ steps }: { steps: OrderStep[] }) {
  return (
    <ol className={cx(card, 'space-y-4 px-4 py-5')}>
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="flex gap-3"
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          <span
            className={cx(
              'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              step.state === 'done' && 'bg-success text-white',
              step.state === 'current' && 'bg-warning text-white',
              step.state === 'todo' && 'border-2 border-border text-muted',
            )}
          >
            {step.state === 'done' ? <CheckIcon size={16} strokeWidth={3} /> : i + 1}
            <span className="sr-only">
              {step.state === 'done'
                ? 'เสร็จแล้ว'
                : step.state === 'current'
                  ? 'ตอนนี้'
                  : 'ยังไม่ถึง'}
            </span>
          </span>
          <div>
            <p className={cx('font-semibold', step.state === 'todo' && 'text-muted')}>
              {step.title}
              {step.state === 'current' && ' (ตอนนี้)'}
            </p>
            <p className="text-sm text-muted">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
