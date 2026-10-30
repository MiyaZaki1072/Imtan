export const TIME_ZONE = 'Asia/Bangkok';

/** `4500` → `฿45`; decimals only when there are satang (`4550` → `฿45.50`). */
export function formatBaht(satang: number): string {
  const hasSatang = satang % 100 !== 0;
  return `฿${(satang / 100).toLocaleString('en-US', {
    minimumFractionDigits: hasSatang ? 2 : 0,
    maximumFractionDigits: hasSatang ? 2 : 0,
  })}`;
}

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 24 h Bangkok time, e.g. `11:42`. Append " น." where the design shows it. */
export function formatClock(date: Date | string): string {
  return clock.format(typeof date === 'string' ? new Date(date) : date);
}

/** Whole minutes, rounded up; any wait above zero shows at least 1. */
export function waitMinutes(seconds: number): number {
  return seconds <= 0 ? 0 : Math.max(1, Math.ceil(seconds / 60));
}

export function queueLabel(prefix: string, queueNo: number): string {
  return `${prefix}-${queueNo}`;
}
