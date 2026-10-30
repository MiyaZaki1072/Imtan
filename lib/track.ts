'use client';

/** Fire-and-forget research event (PLAN.md §5c). Never blocks or breaks a screen. */
export function track(name: string, props?: Record<string, string | number | boolean>) {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, props }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking is optional.
  }
}
