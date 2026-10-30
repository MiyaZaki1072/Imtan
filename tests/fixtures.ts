import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { parseDemoData } from '@/lib/demo-data/parse';
import type { Menu, Selections, Shop } from '@/lib/menu';

export function readDemoYaml(): unknown {
  return parse(readFileSync(path.join(__dirname, '..', 'data', 'demo-shops.yaml'), 'utf8'));
}

/** Fresh copy of the YAML data per call, so tests can flip availability freely. */
export function loadShops(): Shop[] {
  return parseDemoData(readDemoYaml()).shops;
}

export function shop(shops: Shop[], slug: string): Shop {
  const s = shops.find((x) => x.slug === slug);
  if (!s) throw new Error(`no shop ${slug}`);
  return s;
}

export function menu(s: Shop, name: string): Menu {
  const m = s.menus.find((x) => x.name === name);
  if (!m) throw new Error(`no menu ${name} in ${s.slug}`);
  return m;
}

/** Build selections by group and option names: { เนื้อสัตว์: ['หมูกรอบ'] }. */
export function pick(m: Menu, byName: Record<string, string[]>, base: Selections = {}): Selections {
  const out: Selections = { ...base };
  for (const [groupName, optionNames] of Object.entries(byName)) {
    const g = m.groups.find((x) => x.name === groupName);
    if (!g) throw new Error(`no group ${groupName} in ${m.name}`);
    out[g.id] = optionNames.map((n) => {
      const o = g.options.find((x) => x.name === n);
      if (!o) throw new Error(`no option ${n} in ${groupName}`);
      return o.id;
    });
  }
  return out;
}
