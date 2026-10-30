// npm run seed: data/demo-shops.yaml → supabase/seed.sql
// Fails on an unknown key or a missing value in the YAML (never guesses).

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { parseDemoData } from '../lib/demo-data/parse';
import { buildSeedSql } from '../lib/demo-data/seed-sql';

const root = path.join(__dirname, '..');
const data = parseDemoData(parse(readFileSync(path.join(root, 'data', 'demo-shops.yaml'), 'utf8')));
const out = path.join(root, 'supabase', 'seed.sql');
writeFileSync(out, buildSeedSql(data), 'utf8');

const menus = data.shops.flatMap((s) => s.menus);
console.log(
  `Wrote ${path.relative(root, out)}: ${data.shops.length} shops, ${menus.length} menus, ` +
    `${menus.flatMap((m) => m.variants).length} variant rows.`,
);
