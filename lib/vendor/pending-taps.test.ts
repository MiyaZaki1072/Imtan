import { describe, expect, it } from 'vitest';
import { replayTaps, type PendingTap } from './pending-taps';

const t = (orderId: string, status: PendingTap['status']): PendingTap => ({
  orderId,
  label: orderId,
  status,
});

describe('replayTaps', () => {
  it('sends in order and drops rejected taps', async () => {
    const sent: string[] = [];
    const r = await replayTaps([t('a', 'ready'), t('b', 'cooking'), t('a', 'picked_up')], async (x) => {
      sent.push(`${x.orderId}:${x.status}`);
      return x.orderId === 'b' ? 'rejected' : 'ok';
    });
    expect(sent).toEqual(['a:ready', 'b:cooking', 'a:picked_up']);
    expect(r.left).toEqual([]);
    expect(r.rejected.map((x) => x.orderId)).toEqual(['b']);
  });

  it('stops at a network failure and keeps the rest in order', async () => {
    const taps = [t('a', 'ready'), t('b', 'ready'), t('c', 'ready')];
    const r = await replayTaps(taps, async (x) => (x.orderId === 'b' ? 'network' : 'ok'));
    expect(r.left.map((x) => x.orderId)).toEqual(['b', 'c']);
  });
});
