// Shared Tailwind class strings. Touch targets: 44 px customer, 48 px vendor.

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const btnPrimary = cx(button, 'bg-primary text-white hover:bg-primary-hover');
export const btnSecondary = cx(button, 'border border-border bg-surface text-ink hover:bg-bg');
export const btnSuccess = cx(button, 'bg-success text-white hover:brightness-95');
export const btnWarning = cx(button, 'bg-warning text-white hover:brightness-95');
export const btnDangerText = cx(button, 'text-danger hover:bg-danger-soft');
export const btnLarge = 'min-h-14 w-full text-lg';

export const card = 'rounded-2xl border border-border bg-surface';
export const input =
  'min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-base text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none';
export const label = 'mb-1.5 block text-sm font-semibold text-ink';
