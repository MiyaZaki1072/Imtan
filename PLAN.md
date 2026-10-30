# อิ่มทัน (Imtan) — Implementation Plan v2 (prototype)

Web app for the Engineering canteen at Chulalongkorn University. Students see every shop's queue, customise and order, pay, get a queue number with a live wait estimate, and get an alert when the food is ready. Vendors run a live order board on a tablet or phone.

Design reference: `design/` (12 annotated screens + flow diagram). Demo menu data: `data/demo-shops.yaml` (5 real shops from the team's research). Rules for the coding agent: `CLAUDE.md`.

---

## 0. What this build is (read first)

**A working prototype, not a live system.** It is used to:
1. **Present to the professor:** walk through the full flow live, phone + vendor board side by side.
2. **Interview restaurant owners:** let each vendor try *their own shop's* board and menu on a tablet while orders flow in, then collect feedback (WS 8.2 vendor guide).
3. Optionally, let a few students try it for usability feedback.

**No real food, no real money, no real customers.** Payment is a **built-in demo** that confirms itself in about 2 seconds (no vendor tap). Orders during demos come from presenters, testers, or the **demo tools** (§5d).

**Engineering posture: "prototype-grade, but not fragile."**
- **Do:** everything the demo shows must work reliably in front of an audience (atomic queue numbers, correct prices, live updates, no data mixing between shops), and the cheap security basics stay in.
- **Don't:** load testing, real payment providers, monitoring, or heavy automated test suites. Those are listed under "If it becomes real" (§10).

**What feedback from this prototype can and can't support** (for WS 8.2):
- **Can:** whether the flow is understandable, whether vendors would use the board, which options matter, whether prices and menus are modelled right, and what they'd change.
- **Can't:** real ghost-order reduction, real cooking times, or real wait accuracy.

**Milestones** (test/presentation date not set):
- **M1 — Demo-ready (Phases 0–6):** the full customer + vendor flow, all 5 shops, demo tools, a rehearsal.
- **M2 — Complete prototype (Phases 7–9):** full menu-structure editor, pre-orders, history, admin app.

If the presentation is soon, present M1.

## 1. Decisions (locked)

| Area | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript) + Tailwind, on **Vercel** (functions region `sin1`) |
| Backend | **Supabase** (region Singapore): Postgres, Auth, Realtime, `pg_cron`. Use a hosted project (local Docker is optional) |
| Business logic | **TypeScript server actions** handle validation and pricing in `lib/menu/`. The browser preview uses the same code. **SQL** only does what must be atomic: writing an order + its items, assigning queue numbers, recomputing shop stats |
| Live updates | Supabase Realtime (`postgres_changes`) is a nudge only; refetch on reconnect and on focus |
| Alerts | **In-page alert first:** full-screen green, sound, vibration, screen kept awake. Web Push (VAPID, `web-push`) on top. In demos the presenter calls the number out |
| Customer login | Guest: type a display name, which creates an anonymous Supabase session kept on the device. **"Sign in with Chula account" is a placeholder button** (shows a note, then focuses the name field) |
| Vendor/admin login | Username + password (`<username>@imtan.local` in Supabase Auth). One shared account per shop |
| Vendor sees | Queue label + customer name, e.g. `ส้ม-27 · Fay` |
| Queue labels | Shop's own short Thai prefix: `ส้ม-27`, `ไก่ตุ๋น-27`, `เหนียว-27`, `น้ำตก-27`, `บึก-27` (editable). Reset daily at 00:00 Bangkok time |
| Payment | **`demo` provider only:** fake PromptPay screen → "ชำระเงิน (จำลอง)" → auto-confirmed. Built behind a `PaymentProvider` interface so a real one can be added later (§10) |
| Paid-order cancel | Customer can't cancel after paying; the vendor can (refund recorded as simulated) |
| Walk-ins | **One-tap "+1 คิวหน้าร้าน"** (no menu, optional dish count) so walk-ins count toward wait times. A full walk-in order form also exists |
| Language / time | Thai UI, English code; `Asia/Bangkok`, 24 h `HH:mm น.` |

## 2. Roles

| Role | How they get in | Can do |
|---|---|---|
| `customer` | Anonymous sign-in + display name | Browse, customise, order, pay (demo), see own orders, abandon an **unpaid** order, mark own order received, give feedback |
| `vendor` | Shop account | **Own shop only:** board actions, +1 walk-in, walk-in form, cancel paid order, sold-out ingredients, prices and availability, shop settings; full menu-structure editing in Phase 7 |
| `admin` | Admin account | Everything for every shop, plus demo tools (§5d), reset, CSV export |

## 3. Screens and routes

| # | Screen | Route | M |
|---|---|---|---|
| 0 | Welcome: name + Chula placeholder + iOS install-first choice (§5) | `/welcome` | 1 |
| 1 | Home: every shop's live queue (category, dishes ahead, wait, ว่าง/ปานกลาง/แน่น) + my active order | `/` | 1 |
| 2 | Scan QR (QR is a plain URL, so the phone camera works too) | `/scan` | 1 |
| 3 | Shop menu by category, "เริ่ม ฿50", sold-out state, cart bar | `/s/[slug]` | 1 |
| 3a | Customize sheet (§4a groups, Rules, defaults, live price, qty, note) | `/s/[slug]?menu=<id>` | 1 |
| 3b | Cart: lines with kitchen summaries, allergy field, `pair_only` / ฿20 warnings, total | `/s/[slug]/cart` | 1 |
| 4 | Pre-order: choose pickup time | `/s/[slug]/preorder` | 2 |
| 4b | Pay (demo): fake PromptPay card labelled "ตัวอย่าง — สแกนไม่ได้", amount, 5:00 countdown, "ชำระเงิน (จำลอง)", expired state, abandon | `/orders/[id]/pay` | 1 |
| 5–10 | Order page: got queue → waiting → cooking → **ready (in-page alert)** → received ("ได้รับอาหารแล้ว") → feedback | `/orders/[id]` | 1 |
| 6 | Enable notifications + iPhone guide | `/notifications` | 1 |
| 10b | History + reorder | `/history` | 2 |
| 11 | Vendor board | `/vendor` | 1 |
| 12 | +1 walk-in (one tap) and full walk-in form | `/vendor` header, `/vendor/walk-in` | 1 |
| 13 | Menu: prices and availability (M1); full structure editor (M2) | `/vendor/menu` | 1/2 |
| 14 | Sold-out ingredients (big toggles) | `/vendor/stock` | 1 |
| 15 | Shop settings: name, category, prefix, open/paused, wait mode | `/vendor/settings` | 1 |
| 16 | **Presenter view (§5d)**: phone frame (customer) + vendor board side by side, plus demo controls | `/demo` | 1 |
| — | Vendor/admin login | `/login` | 1 |
| — | Admin: demo tools, reset, CSV export, QR posters (M1); full app (M2) | `/admin` | 1/2 |

## 4. Data model

```sql
create type user_role         as enum ('customer','vendor','admin');
create type order_status      as enum ('awaiting_payment','expired','abandoned',
                                       'queued','cooking','ready','picked_up','cancelled');
create type order_source      as enum ('app','walk_in_quick','walk_in_full','simulated');
create type payment_method    as enum ('demo','cash');
create type wait_mode         as enum ('auto','manual');
create type option_group_kind as enum ('variant','tiered','choice','remove','toppings');
create type wait_feedback     as enum ('faster','accurate','slower');

profiles (id uuid pk → auth.users, display_name text check (1..30 chars),
          role user_role not null default 'customer', shop_id uuid null → shops, created_at)

shops (id, slug unique, name, category, queue_prefix text not null check (1..8 chars),
       is_open bool default true, allow_item_note bool, allow_allergy_note bool,
       wait_mode wait_mode default 'auto',
       manual_seconds_per_item int not null,      -- vendor value; also fallback for auto
       learned_seconds_per_item int null,         -- §4c; written by refresh_shop_stats()
       items_in_queue int default 0,              -- these stats are written ONLY by refresh_shop_stats()
       est_wait_seconds int default 0, busy_level text default 'ว่าง',
       stats_updated_at timestamptz, updated_at)

ingredients        (id, shop_id, name, is_available bool default true, unique (shop_id, name))
menus              (id, shop_id, category, name, cook_seconds int, base_price_satang int null,
                    pair_only bool default false, is_available bool default true,
                    deleted_at timestamptz null, sort int)
menu_ingredients   (menu_id, ingredient_id, primary key both)
option_groups      (id, menu_id, name, kind, min_select, max_select, sort,
                    show_when_group_id uuid null, show_when_option_ids uuid[] null,
                    select_all_label text null, note text null)
options            (id, group_id, name, price_delta_satang int default 0 check (>= 0),
                    ingredient_id uuid null, is_default bool, is_available bool default true, sort int)
menu_variants      (id, menu_id, option_ids uuid[] not null,  -- one option per variant group, sorted
                    price_satang int null check (> 0),        -- null only while a new combo awaits a price (Phase 7)
                    is_available bool default true, unique (menu_id, option_ids))
group_tier_prices  (group_id, selected_count, price_satang, primary key (group_id, selected_count))

shop_daily_counters (shop_id, day date, last_no int, primary key (shop_id, day))

orders (id, shop_id, customer_id uuid null, customer_name text,
        queue_no int null, queue_label text null, day date null,
        source order_source, status order_status,
        item_count int not null check (>= 1),     -- Σ qty, or the +1 walk-in count
        total_satang int null,                    -- null for quick walk-ins
        payment_expires_at timestamptz null,      -- null for walk-ins / simulated
        paid_at, pickup_at, release_at, queued_at, -- queued_at = greatest(paid_at, release_at)
        created_at, started_at, ready_at, picked_up_at, cancelled_at,
        picked_up_by text null check (in ('vendor','customer','auto')),
        cancel_reason text null, refund_method payment_method null,
        last_called_at timestamptz null, allergy_note text null (≤100),
        feedback wait_feedback null, estimated_wait_seconds int null,
        unique (shop_id, day, queue_no))

order_items (id, order_id, menu_id, menu_name, selections jsonb, kitchen_summary text,
             note text null (≤100), qty int (1..20), unit_price_satang, line_total_satang)

payments (id, order_id unique, method, status text, amount_satang, created_at, confirmed_at)

events (id bigserial, at timestamptz default now(), actor_role, user_id null, shop_id null,
        order_id null, name text, props jsonb)    -- §5c feedback/research log

push_subscriptions (id, user_id, endpoint unique, p256dh, auth, created_at)
```

### 4a. Menu model (`data/demo-shops.yaml` schema v2 maps 1:1)

| YAML | Table/column |
|---|---|
| shop `slug,name,category,queue_prefix,wait_mode,manual_seconds_per_item,allow_item_note,allow_allergy_note` | `shops` |
| shop `ingredients[]` | `ingredients` |
| shop `confirmed[]`, `assumed[]` | not stored (team documentation; show `assumed` in vendor interviews to ask about) |
| menu `name,category,cook_seconds,base_price,pair_only` | `menus` (baht × 100 → satang) |
| menu `requires_ingredients[]` | `menu_ingredients` |
| group `name,kind,min,max,note,select_all_label` | `option_groups` |
| group `show_when: {group, options[]}` | `show_when_group_id`, `show_when_option_ids` |
| group `tier_prices: {count: baht}` | `group_tier_prices` |
| option `name,price,ingredient,default` | `options` |
| menu `variants: [{options: {group: option}, price}]` | `menu_variants` (every combination listed) |

**Price of one item** = base + Σ `price_delta_satang` of the selected `choice` options, × qty.

**Base** comes from exactly one source per menu:
1. the `menu_variants` row for the selected option of each `variant` group, or
2. the `group_tier_prices` row for the number of options selected in the `tiered` group, or
3. `menus.base_price_satang`.

Prices are never computed by formula at checkout.

| kind | Picks | Price | Example |
|---|---|---|---|
| `variant` | exactly 1 | selects the variant row | เนื้อสัตว์, รูปแบบเสิร์ฟ, ขนาด, ไส้ |
| `tiered` | min..max | count → tier row | โปรตีน (พี่ส้ม: 1 = ฿50, 2 = ฿60) |
| `choice` | min..max | + delta per option | เส้น, น้ำซุป, ความเผ็ด, ไข่เพิ่ม, ราดเพิ่ม, เพิ่มอื่น ๆ |
| `remove` | 0..n | none | ไม่ใส่ … |
| `toppings` | 0..n, all pre-selected | none | เครื่องก๋วยเตี๋ยว + "ใส่ทุกอย่าง" |

**Rules**
- A group is visible only when its `show_when` options are selected. Validation drops hidden groups even if the client sends them.
- **Availability:**
  - An option is unavailable if it is off or its ingredient is sold out.
  - A menu is unavailable if it is off, deleted, any `menu_ingredients` row is sold out, or a required group has no available option.
  - Changes reach open pages via Realtime on `ingredients`, `menus` and `options`.
- **Defaults** come from the data. Only min ≥ 1 groups without a default block "เพิ่มลงตะกร้า", and the price updates live.
- **Cart:** different selections become separate cart lines. One cart = one shop = one order = one queue number.
- **Extras and notes:** paid extras are always priced buttons. The note (≤ 100 chars) is labelled "ร้านอาจทำตามไม่ได้ทุกกรณี".
- **Allergy** is an order-level field, separate from preferences, with the warning "ร้านไม่สามารถรับประกันว่าไม่มีการปนเปื้อน". The vendor card shows a red **แพ้อาหาร** badge.
- **`pair_only`:** these items need another menu in the cart. A cart total under ฿20 is blocked, which keeps the ฿20 PromptPay minimum realistic.
- **Kitchen summary:** `kitchen_summary` is built by `lib/menu/summary.ts` in group order, e.g. `กะเพราหมูสับ / ราดข้าว / ธรรมดา / เผ็ดน้อย / ไข่ดาว ไข่แดงสุก / ไม่ใส่ถั่วฝักยาว`.
- **One implementation:**
  - `lib/menu/` holds pure functions: `visibleGroups`, `availability`, `validate`, `price`, `kitchenSummary`.
  - The browser uses them for the live preview.
  - The `placeOrder` server action reloads the menu from the DB, runs the **same** functions as the truth, then calls `insert_order()`.
  - SQL never computes prices.

### 4b. Security basics (cheap, keep them — a demo must not be breakable by one curious student)
- **Functions:**
  - The first migration runs `alter default privileges revoke execute on functions from public`.
  - Every `security definer` function sets `search_path = public, pg_temp`.
  - Internal functions (`insert_order`, `confirm_payment`, `assign_queue_number`, `refresh_shop_stats`, `add_quick_walk_in`, `vendor_*`, `demo_*`) are granted to `service_role` **only**.
  - Customer functions (`abandon_order`, `mark_received`, `submit_feedback`) are granted to `authenticated` and check that the caller owns the order.
- **Profiles:**
  - Only `grant update (display_name) on profiles to authenticated`.
  - `handle_new_user` copies only a trimmed `display_name`. Role is always `customer`.
- **Writes:**
  - Clients never write tables directly. Server actions call `requireCustomer()`, `requireVendor(shopId)` or `requireAdmin()` (checked on the server), then use the service-role client.
  - Vendor shop edits use a whitelist: `name, category, queue_prefix, is_open, wait_mode, manual_seconds_per_item, allow_*`.
- **RLS reads:**
  - Menus, shops and ingredients: public.
  - Orders and items: customer sees their own. Vendor sees their own shop's orders where `paid_at is not null` or the source is not `app`.
  - Events: admin only.
- **Demo routes:** demo payment and demo tools return 404 unless `DEMO_PAYMENTS=true` / an admin is signed in. The demo payment checks that the caller owns the order and that it is still `awaiting_payment`.
- **Secrets:** the service-role key and the VAPID private key are only used in `server-only` modules.

### 4c. Queue, status and wait logic
- **Statuses:**
  - `awaiting_payment` → `queued` (paid) | `expired` (5 min) | `abandoned`
  - `queued` → `cooking`, **or straight to `ready`** (vendors may skip "เริ่มทำ")
  - `cooking` → `ready`
  - `ready` → `picked_up` (by the vendor, by the customer's "ได้รับอาหารแล้ว", or automatically after 30 min)
  - `queued`/`cooking` → `cancelled` (vendor; refund recorded as simulated)
  - **Feedback opens at `ready`.**
- **Queue numbers:** assigned only in `confirm_payment()` (or for walk-ins / simulated orders), via `FOR UPDATE` on `shop_daily_counters`, with the unique constraint as a safety net.
- **In queue** = `queued`/`cooking` and `release_at <= now()`. Ordered by `queued_at`, then `queue_no`.
- **Wait is counted in dishes, not orders:**
  - dishes ahead = Σ `item_count` of in-queue orders before mine
  - wait (queued) = (dishes ahead + my dishes) × `seconds_per_item`
  - wait (cooking) = max(0, my dishes × `seconds_per_item` − time since `started_at`)
- **`seconds_per_item`:**
  - `manual` = the vendor's value.
  - `auto` = the median over today's last 10 `ready` events of (gap since the previous `ready_at` ÷ that order's `item_count`), counting only gaps under 15 min, clamped to 20 s–10 min, falling back to manual.
  - In demos the vendor normally uses **manual**, so the numbers look realistic.
- **`refresh_shop_stats(shop_id)`** runs from an `orders` trigger, after settings change, and **every minute via `pg_cron`**. The cron run also expires unpaid orders, auto-closes stale `ready` orders, and releases pre-orders.
  - **Busy level:** ว่าง < 5 min ≤ ปานกลาง ≤ 12 min < แน่น.

## 5. Realtime, alerts and iPhone
- **Subscriptions:** Home → `shops`. Shop page → that shop's `ingredients`, `menus`, `options`. Order page → its own order. Vendor board → its shop's `orders`. Refetch on reconnect and focus, and show an offline banner.
- **Ready alert (primary):**
  - full-screen green
  - a chime (audio is enabled after the first tap)
  - `navigator.vibrate`
  - Wake Lock while waiting
  - the title flashes "พร้อมแล้ว! ส้ม-27"
- **Web Push:**
  - Sent after `ready` and on "เรียกซ้ำ".
  - Never blocks the status change. Remove subscriptions that return 404/410.
  - `public/sw.js` handles `push` and `notificationclick`. A manifest makes the app installable.
- **iPhone:** push only works in a Home-Screen-installed app, and that app **doesn't share Safari's storage**. `/welcome` detects iOS Safari (not installed) and offers two paths:
  - (a) "ติดตั้งก่อน เพื่อรับแจ้งเตือน": a 3-step guide, then the name is entered inside the installed app
  - (b) "สั่งเลย (ไม่มีแจ้งเตือน — เปิดหน้าคิวไว้)"
  - **For presentations, demo push on an Android phone.**

## 5b. Payment (demo only)
- `lib/payments/` defines a `PaymentProvider` interface (`createPayment`, `getStatus`, optional `handleWebhook`). Only the `demo` provider is built.
- **Pay page:**
  - shows a fake PromptPay card (amount, "ตัวอย่าง — สแกนไม่ได้", 5:00 countdown)
  - "ชำระเงิน (จำลอง)" → 2 s "กำลังตรวจสอบการโอน…" → the server calls `confirm_payment(order,'demo')`. Nobody at the shop taps anything.
  - the page listens to its own order and redirects to the ticket
  - labelled "โหมดทดสอบ — ไม่มีการตัดเงินจริง"
- **Expiry and abandon:** expiry via `pg_cron`. Reads also treat past-expiry orders as expired. Abandon is available while unpaid.

## 5c. Feedback log (for WS 8.2 and the professor)
- **Server events:** `order_created`, `paid`, `expired`, `abandoned`, `started`, `ready`, `received`, `picked_up`, `walk_in_quick`, `ingredient_toggled`, `price_changed`, `feedback`, `push_sent/failed`.
- **Client events** via `POST /api/events` (own user only, small rate limit): `shop_viewed`, `customize_opened`, `cart_opened`, `pay_viewed`, `alert_shown`, `notif_permission`.
- `/admin` exports **CSV** of events and orders, UTF-8 with BOM so Thai opens correctly in Sheets/Excel.

## 5d. Demo tools (admin, `DEMO_PAYMENTS=true`) — what makes presentations and interviews work
- **Presenter view `/demo`:**
  - a 390 px phone frame running the customer app (same origin, an iframe of `/`) next to a chosen shop's vendor board
  - one laptop, one screen, the whole story visible
- **"จำลองช่วงพีค" (simulate rush):**
  - creates N simulated paid orders (source `simulated`) for a shop or all shops
  - uses random valid selections from that shop's real menu (built by `lib/menu/`, so they're always valid), random Thai nicknames, and spaced arrivals (e.g. 10 orders over 2 min)
  - fills the board for a vendor interview and makes Home show ปานกลาง/แน่น
- **"เดินคิวอัตโนมัติ" (auto-advance):** optionally moves simulated orders through cooking → ready → picked up at the shop's `seconds_per_item`, so the queue moves during a talk without anyone tapping.
- **Reset demo:**
  - per shop or all
  - cancels open orders, resets today's counters, restores ingredient availability and **prices from the YAML seed**
  - confirm dialog before running
- **Interview mode:** log in on a tablet as that shop's vendor and open `/vendor?interview=1`, which shows a small banner "โหมดสาธิต" and a floating "สร้างออเดอร์ตัวอย่าง" button so the owner can trigger orders themselves.

## 6. Build phases

Start each phase in Claude Code in **plan mode**: *"Read PLAN.md and CLAUDE.md. Plan Phase N only."* End each phase with its checks passing and a commit.

### M1 — Demo-ready

**Phase 0 — Accounts (you, about 30 min)**
- [ ] Supabase project (**Singapore**): turn on **Anonymous sign-ins**, turn off "Confirm email", enable the **pg_cron** extension, and raise the anonymous sign-in limit per IP.
- [ ] Create the GitHub repo and connect it to a Vercel project (region `sin1`).
- [ ] `npx web-push generate-vapid-keys`
- [ ] Add env vars to Vercel and `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - `DEMO_PAYMENTS=true`
- [ ] Put `PLAN.md`, `CLAUDE.md`, `data/` and `design/` in the repo.

**Phase 1 — Scaffold + all screens with sample data**
- Next.js, TS, Tailwind tokens from CLAUDE.md, IBM Plex Sans Thai, ESLint/Prettier, Vitest.
- Build every M1 screen in §3 with data from `data/demo-shops.yaml`, mobile-first at 390 px. Vendor screens target a 1024 px tablet and still work on a phone.
- Components: `ShopRow`, `BusyPill`, `QueueTicket`, `OrderSteps`, `MenuCard`, `OptionGroup` (all 5 kinds), `CustomizeSheet`, `CartLine`, `PayCard`, `ReadyAlert`, `VendorOrderCard`, `BottomNav`.
- **Accept:** screens match `design/` (new screens 3a, 3b, 4b, 13–16 in the same style), no horizontal scroll at 360 px.

**Phase 2 — Database, security basics, auth, seed**
- Migrations for §4 and §4b, `pg_cron` jobs, `supabase gen types`.
- `scripts/seed-from-yaml.ts`: reads `data/demo-shops.yaml` and writes `supabase/seed.sql`. Map fields per §4a, convert baht → satang, resolve names → ids. **Fail on anything unknown; never guess.** Also seeds 1 admin and 5 vendor accounts (passwords from env). The same mapping is reused by "Reset demo".
- `/welcome`, `/login`, middleware, and the `require*` helpers.
- **Accept (a short script):**
  - A customer can't run `confirm_payment`, `insert_order` or `vendor_*`, and can't set their own role.
  - Customer A can't read customer B's order. Vendor A can't read shop B's orders or any unpaid order.
  - 50 parallel `assign_queue_number` calls give 50 unique numbers.
  - Seed counts are 5 shops, 33 menus and 127 variant rows.

**Phase 3 — Menus, customise, cart**
- `lib/menu/` with unit tests using the YAML. Required cases:
  - พี่ส้ม 2 proteins + ไข่ข้น + แกงกะหรี่ = ฿80; 3 proteins is rejected.
  - เจ๊บึก กะเพราหมูกรอบ / เป็นกับข้าว / พิเศษ + ไข่ดาว ไข่แดงไม่สุก = its variant row + ฿10.
  - Doneness is rejected without ไข่ดาว.
  - ความเผ็ด is hidden for น้ำใส.
  - ข้าวเหนียว alone is rejected.
  - หมูกรอบ sold out at เจ๊บึก disables it in every เจ๊บึก menu but **not** at shop 2 (ingredients are per shop).
- Shop page, customise sheet, cart, live sold-out updates.
- **Accept:** for every menu, the preview total equals the server total, and a tampered client price is ignored.

**Phase 4 — Order, demo payment, order page**
- `placeOrder` → `insert_order` → `/orders/[id]/pay`.
- Demo provider, expiry, abandon.
- Order page with all states, the in-page ready alert, "ได้รับอาหารแล้ว", and feedback at `ready`.
- Home live stats, with wait counted in dishes.
- **Accept:**
  - A queue number appears only after demo payment.
  - An unpaid order left for 5 min expires within about 1 min, never gets a number, and never appears on the board.
  - Home on a second phone updates within 2 s.

**Phase 5 — Vendor board and tools**
- `/vendor` columns รอทำ / กำลังทำ / พร้อมรับ.
  - Buttons: "เริ่มทำ", "เสร็จแล้ว" (also allowed straight from รอทำ), "ลูกค้ารับแล้ว", "เรียกซ้ำ", "ยกเลิก + คืนเงิน".
  - Each card shows the large `kitchen_summary`, qty, note and the **แพ้อาหาร** badge.
  - "รวมเมนูซ้ำ" groups identical summaries. A chime plays for new orders, and Wake Lock keeps the screen on.
- Header buttons:
  - **"+1 คิวหน้าร้าน"** with a dish-count stepper, showing the new label large
  - the full walk-in form
  - ของหมด
  - เมนู/ราคา
  - ตั้งค่าร้าน
  - ปิดรับชั่วคราว
- `/vendor/stock`: big toggles per ingredient.
- `/vendor/menu` (M1): edit prices (each variant row, tier row, option delta, base price) and availability. Includes a "ตั้งราคาทั้งแถว" helper. New prices apply to new orders only.
- `/vendor/settings`: the whitelisted fields, plus wait mode ("ใช้เวลาประมาณ __ นาทีต่อจาน").
- **Accept:**
  - The full flow works on two devices, and "เสร็จแล้ว" works straight from รอทำ.
  - +1 walk-in and manual-mode changes update Home immediately.
  - A price change shows on an open shop page without reloading, while old orders keep their prices.
  - Vendor A can't change shop B (test the server actions, not just the UI).

**Phase 6 — Alerts, push, demo tools, feedback log → rehearsal**
- `/notifications`, push subscribe/send, and the iOS install-first flow.
- §5c logging + CSV export.
- §5d demo tools: `/demo` presenter view, simulate rush, auto-advance, reset, interview mode.
- QR posters (A5 per shop, `qrcode`).
- Daily Vercel Cron on `/api/health` keep-alive. One Playwright **smoke test**: order → demo pay → vendor ready → customer sees the alert.
- **Rehearsal:** run §7 end to end on the presentation laptop plus one Android and one iPhone, over campus Wi‑Fi and over mobile data.
- **Accept:**
  - "จำลองช่วงพีค" with 10 orders fills a board in under 2 minutes, all valid and correctly priced.
  - Reset brings everything back to the seed.
  - An Android phone receives the ready push within 5 s. An iPhone without install still gets the in-page alert.
  - The CSV opens with correct Thai.

### M2 — Complete prototype

**Phase 7 — Full menu-structure editor (vendors edit everything)**
- Vendors can add, rename and delete:
  - menus and categories
  - option groups (kind, min/max, `show_when`, select-all label, note)
  - options, ingredients, and the links between them
- When variant options change, the variant grid regenerates. New combinations have a null price and must be filled in before the menu can be made available.
- A preview shows the menu as customers see it.
- Validation blocks states customers can't order. Deleting a menu that has past orders is a soft delete.

**Phase 8 — Pre-orders, history, polish**
- Pre-order: `release_at = pickup_at − (item_count × seconds_per_item) − 3 min`, rounded. The cron job releases it into the queue.
- `/history` + reorder. Lines that are no longer available are dropped, with a notice.
- Empty, error and loading states everywhere.

**Phase 9 — Admin app**
- Create shops and vendor accounts, reset passwords, and edit any shop with the same editors.
- A stats page: orders, paid vs expired vs abandoned, vendor tap delays, feedback.

## 7. Presentation and interview day

**Checklist**
- [ ] Presentation laptop with `/demo` open, logged in as admin, demo reset that morning.
- [ ] An Android phone for the live push moment, and one iPhone to show the in-page alert.
- [ ] Supabase awake (open the dashboard the day before), and the Vercel deployment green.
- [ ] For each shop interview: a tablet logged in as that shop, in interview mode; the shop's `assumed` list from `data/demo-shops.yaml` printed to ask about; and the WS 8.2 vendor guide.

**Professor demo script (about 5 min)**
1. Home shows every shop ว่าง.
2. Press "จำลองช่วงพีค", and Home turns ปานกลาง/แน่น.
3. On the phone: pick the shortest wait, customise a เจ๊บึก order (show the Rules: ไข่ดาว → ความสุก), and see the live price.
4. Pay (demo): a queue number appears and the board updates instantly.
5. Mark หมูกรอบ sold out, and it disappears for customers.
6. Vendor taps "เสร็จแล้ว": the in-page alert and Android push fire.
7. Feedback, then the CSV export.

**Vendor interview script**
1. Show their own menu.
2. Ask the `assumed` items.
3. Let them run the board under a simulated rush.
4. Try +1 walk-in, sold-out and a price change.
5. Ask the WS 8.2 questions.

## 8. Out of scope for the prototype
Real Chula OAuth (the placeholder stays), real payments, multiple canteens, staff-level vendor accounts, native apps, load testing, monitoring.

## 9. Open items for the team
- The **presentation/interview dates**, which decide whether M2 is ready in time.
- The `assumed` values per shop. Confirm them during interviews, or let vendors fix them in `/vendor/menu`.
- Whether vendors like their queue prefixes when called out loud.

## 10. If it becomes real (not part of this build)
1. A real payment provider: Opn PromptPay, or each shop's own PromptPay plus automatic slip check (paid API + KYC). Decide who receives the money.
2. Webhooks that re-fetch the charge and insert `webhook_events` in the same transaction.
3. Late-payment handling (`confirm_payment` accepts `expired` → number or refund).
4. The ฿20 minimum and refunds outside the provider.
5. A full Playwright suite.
6. A load test with pre-created users, because anonymous sign-ins from one IP get rate-limited.
7. Real Chula OAuth via `linkIdentity()` so guest history is kept.
8. Monitoring.
9. A real-money pilot to measure ghost orders and real wait accuracy.
