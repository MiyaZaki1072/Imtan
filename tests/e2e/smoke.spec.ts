import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

// The whole story on two devices: a guest orders and pays (demo), the shop taps
// "เสร็จแล้ว", and the guest's phone turns green. Uses เหนียวไก่วิศวะจุฬา (฿45, no options).

const NAME = 'ทดสอบ smoke';

test.afterAll(async () => {
  // Remove what this test created (the guest user and their order).
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    },
  );
  const { data: users } = await db.from('profiles').select('id').eq('display_name', NAME);
  for (const u of users ?? []) {
    const { data: orders } = await db.from('orders').select('id').eq('customer_id', u.id);
    const ids = (orders ?? []).map((o) => o.id);
    if (ids.length) {
      await db.from('events').delete().in('order_id', ids);
      await db.from('orders').delete().in('id', ids);
    }
    await db.auth.admin.deleteUser(u.id);
  }
});

test('order → demo pay → vendor ready → customer sees the alert', async ({ browser }) => {
  const customer = await (await browser.newContext()).newPage();
  const vendor = await (
    await browser.newContext({ viewport: { width: 1024, height: 768 } })
  ).newPage();

  // Customer: name, shop, add the dish, pay.
  await customer.goto('/welcome?next=/s/niao-kai');
  await customer.getByLabel('ชื่อที่ให้แม่ค้าเรียก').fill(NAME);
  await customer.getByRole('button', { name: 'เริ่มใช้งาน' }).click();
  await customer.waitForURL('**/s/niao-kai');
  await customer.getByRole('button', { name: /^เลือก เหนียวไก่/ }).click();
  await customer.getByRole('button', { name: /^เพิ่มลงตะกร้า/ }).click();
  await customer.getByRole('link', { name: 'ดูตะกร้า' }).click();
  await customer.getByRole('button', { name: 'ไปชำระเงิน' }).click();
  await customer.waitForURL('**/pay');
  await expect(customer.getByText('โหมดทดสอบ — ไม่มีการตัดเงินจริง')).toBeVisible();
  await customer.getByRole('button', { name: 'ชำระเงิน (จำลอง)' }).click();
  await customer.waitForURL('**paid=1');
  await expect(customer.getByText('ชำระเงินแล้ว ได้คิวแล้ว!')).toBeVisible();
  const label = (await customer.locator('p.text-6xl').innerText()).trim();
  expect(label).toMatch(/^เหนียว-\d+$/);

  // Vendor: tap the shop, finish that order straight from รอทำ.
  await vendor.goto('/login');
  await vendor.getByRole('button', { name: /เหนียวไก่วิศวะจุฬา/ }).click();
  await vendor.waitForURL('**/vendor');
  const card = vendor.getByRole('article', { name: `ออเดอร์ ${label}` });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: 'เสร็จแล้ว', exact: true }).click();

  // Customer: the full-screen green alert.
  await customer.getByRole('button', { name: 'ดูสถานะคิวของฉัน' }).click();
  await expect(customer.getByRole('alertdialog')).toContainText('อาหารพร้อมแล้ว!', {
    timeout: 20_000,
  });
  await customer.getByRole('button', { name: 'ได้รับอาหารแล้ว' }).click();
  await expect(customer.getByText('รับอาหารแล้ว ขอให้อร่อย!')).toBeVisible();
});
