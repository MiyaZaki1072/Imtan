import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { Shop } from '../menu/types';
import { parseDemoData, type DemoData } from './parse';

// Phase 1 reads the YAML directly as sample data. Phase 2 replaces this with the database.

let cached: DemoData | null = null;

export function loadDemoData(): DemoData {
  if (!cached) {
    const file = path.join(process.cwd(), 'data', 'demo-shops.yaml');
    cached = parseDemoData(parse(readFileSync(file, 'utf8')));
  }
  return cached;
}

export function getShops(): Shop[] {
  return loadDemoData().shops;
}

export function getShop(slug: string): Shop | undefined {
  return getShops().find((s) => s.slug === slug);
}
