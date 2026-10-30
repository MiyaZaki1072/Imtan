// npm run seed:accounts — creates or updates the admin and one vendor account per shop.
// Passwords come from env only (.env.local), never from files in the repo:
//   SEED_ADMIN_USERNAME (default "admin"), SEED_ADMIN_PASSWORD, VENDOR_LOGIN_PASSWORD
// Emails are <username>@imtan.local. Vendor usernames are the shop slugs.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'yaml';
import type { Database } from '../lib/database.types';
import { parseDemoData } from '../lib/demo-data/parse';
import { shopUuid } from '../lib/demo-data/seed-sql';

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const adminUser = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = env('SEED_ADMIN_PASSWORD');
  const vendorPassword = env('VENDOR_LOGIN_PASSWORD');
  for (const [name, pw] of [
    ['SEED_ADMIN_PASSWORD', adminPassword],
    ['VENDOR_LOGIN_PASSWORD', vendorPassword],
  ]) {
    if (pw.length < 6) {
      console.error(`${name} must be at least 6 characters`);
      process.exit(1);
    }
  }

  const root = path.join(__dirname, '..');
  const { shops } = parseDemoData(
    parse(readFileSync(path.join(root, 'data', 'demo-shops.yaml'), 'utf8')),
  );

  const db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const accounts = [
    {
      email: `${adminUser}@imtan.local`,
      password: adminPassword,
      role: 'admin' as const,
      shopId: null,
      name: 'ผู้ดูแล',
    },
    ...shops.map((s) => ({
      email: `${s.slug}@imtan.local`,
      password: vendorPassword,
      role: 'vendor' as const,
      shopId: shopUuid(s.slug),
      name: s.name.slice(0, 30),
    })),
  ];

  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  for (const a of accounts) {
    const existing = list.users.find((u) => u.email === a.email);
    let userId: string;
    if (existing) {
      const { error } = await db.auth.admin.updateUserById(existing.id, { password: a.password });
      if (error) throw error;
      userId = existing.id;
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: a.email,
        password: a.password,
        email_confirm: true,
        user_metadata: { display_name: a.name },
      });
      if (error) throw error;
      userId = data.user.id;
    }
    // The signup trigger always makes a customer; promote here with the service role.
    const { error } = await db
      .from('profiles')
      .update({ role: a.role, shop_id: a.shopId, display_name: a.name })
      .eq('id', userId);
    if (error) throw error;
    console.log(`${existing ? 'updated' : 'created'} ${a.role.padEnd(6)} ${a.email}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
