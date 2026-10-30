import { describe, expect, it } from 'vitest';
import { readDemoYaml } from '@/tests/fixtures';
import { DemoDataError, parseDemoData } from './parse';

type Raw = { shops: Record<string, unknown>[] };

describe('parseDemoData', () => {
  it('maps the YAML: 5 shops, 33 menus, 127 variant rows, prices in satang', () => {
    const { shops, notes } = parseDemoData(readDemoYaml());
    expect(shops).toHaveLength(5);
    expect(shops.flatMap((s) => s.menus)).toHaveLength(33);
    expect(shops.flatMap((s) => s.menus.flatMap((m) => m.variants))).toHaveLength(127);
    const niao = shops.find((s) => s.slug === 'niao-kai')!;
    const sticky = niao.menus.find((m) => m.name === 'ข้าวเหนียว')!;
    expect(sticky.basePriceSatang).toBe(1000);
    expect(sticky.pairOnly).toBe(true);
    expect(notes['pi-som'].assumed.length).toBeGreaterThan(0);
  });

  it('fails on an unknown key', () => {
    const raw = readDemoYaml() as Raw;
    raw.shops[0].opening_hours = '10:00';
    expect(() => parseDemoData(raw)).toThrow(DemoDataError);
    expect(() => parseDemoData(raw)).toThrow(/unknown key "opening_hours"/);
  });

  it('fails on a missing value', () => {
    const raw = readDemoYaml() as Raw;
    delete raw.shops[1].queue_prefix;
    expect(() => parseDemoData(raw)).toThrow(/missing value "queue_prefix"/);
  });

  it('fails on an ingredient that is not in the shop list', () => {
    const raw = readDemoYaml() as Raw;
    const menus = raw.shops[2].menus as Record<string, unknown>[];
    menus[0].requires_ingredients = ['ไม่มีจริง'];
    expect(() => parseDemoData(raw)).toThrow(/not in the shop's list/);
  });
});
