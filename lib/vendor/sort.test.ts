import { describe, expect, it } from 'vitest';
import { sortByStart } from './sort';

describe('sortByStart', () => {
  it('puts a due pre-order ahead of a later walk-in', () => {
    const walkIn = { id: 'w', releaseAt: null, queuedAt: '2026-11-05T04:50:00Z', queueNo: 9 };
    const pre = {
      id: 'p',
      releaseAt: '2026-11-05T04:45:00Z',
      queuedAt: '2026-11-05T03:00:00Z',
      queueNo: 12,
    };
    const later = { id: 'l', releaseAt: '2026-11-05T05:30:00Z', queuedAt: '2026-11-05T03:10:00Z', queueNo: 13 };
    expect(sortByStart([later, walkIn, pre]).map((o) => o.id)).toEqual(['p', 'w', 'l']);
  });
});
