import { describe, expect, it } from 'vitest';
import { readDemoYaml } from '@/tests/fixtures';
import { parseDemoData } from './parse';
import { buildSeedSql, shopUuid } from './seed-sql';
import { uuidV5 } from './uuid';

describe('uuidV5', () => {
  it('matches the RFC 4122 test vector', () => {
    // python: uuid.uuid5(uuid.NAMESPACE_DNS, 'python.org')
    expect(uuidV5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '886313e1-3b8a-5372-9b90-0c9aee199e5d',
    );
  });
});

describe('buildSeedSql', () => {
  const sql = buildSeedSql(parseDemoData(readDemoYaml()));

  it('is deterministic', () => {
    expect(buildSeedSql(parseDemoData(readDemoYaml()))).toBe(sql);
  });

  it('upserts 5 shops, 33 menus and 127 variant rows', () => {
    const rows = (table: string) => {
      const blocks = sql.split(`insert into public.${table} `).slice(1);
      return blocks.reduce(
        (n, b) => n + (b.split('\non conflict')[0].match(/^ {2}\(/gm)?.length ?? 0),
        0,
      );
    };
    expect(rows('shops')).toBe(5);
    expect(rows('menus')).toBe(33);
    expect(rows('menu_variants')).toBe(127);
    expect(sql).toContain(`'${shopUuid('jae-buek')}', 'jae-buek', 'เจ๊บึก'`);
  });

  it('stores baht as satang', () => {
    // ข้าวเหนียว base_price 10 → 1000
    expect(sql).toMatch(/'ข้าวเหนียว', 10, 1000, true/);
  });
});
