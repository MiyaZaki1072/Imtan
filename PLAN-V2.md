# อิ่มทัน V.2 — Plan (Phases 11–17)

Feedback from test round 1 (WS 8.3, 7 testers, NPS +71) turned into features. Extends `PLAN.md`; `CLAUDE.md` rules still apply. **Where the V2 mockups disagree with this plan, follow this plan** (pay first, Thai queue prefix, SVG icons, theme tokens, waits count dishes).

**Status:** Phases 11–16 are built (not committed). Phase 17 is people work.

**Before you demo**
1. `supabase db push`: applies `20261105090000_v2_capacity.sql` and `20261105090100_v2_ratings.sql`. Both are additive. Home reads the new rating columns, so **push before deploying**.
2. `npm run db:types`: regenerates the types. They were hand-edited to match.
3. `npm run check:v2` and the existing `check:phase*` scripts, then `npm run test:e2e`.

## Decisions
| # | Decision | Value |
|---|---|---|
| D1 | Large orders | Per-shop `max_dishes_per_order` (default 10). Above it: "สั่งเกิน N จาน กรุณาสั่งที่หน้าร้าน". App orders only |
| D2 | Pre-order capacity | `preorder_dishes_per_slot` (default 6) per pickup slot |
| D3 | Unpaid orders | Hold their slot until payment expires (5 min) |
| D4 | Wait range | low = `round(0.85·min)`, high = `ceil(1.3·min)`, low ≥ 1, high > low (6 min → 5–8) |
| D5 | Ratings shown | Only at ≥ 3 ratings |

**Out of scope:** chat with the vendor, other canteens, ไทยช่วยไทย/คนละครึ่ง (still an open payment question), "more layouts" (ask ปฏิพล at retest).

## What was built

**11 · Wait range.** `waitRangeMinutes`/`withinWaitRange` (`lib/queue.ts`) and `formatWaitRange` (`lib/format.ts`) on every customer wait. "เวลานี้มาจากไหน?" card (dishes × s/dish, auto vs manual). The picked-up screen says "อยู่ในช่วงที่บอก / นานกว่าที่บอก". `/admin/stats` has an "อยู่ในช่วงที่บอก" column.

**12 · Several open orders.** `getOpenOrders` (`lib/orders/view.ts`), `GET /api/my-orders`, `HomeData.mine` is an array. `/orders` shows a list at 2+ orders. `useReadyAutoOpen` (`components/OpenOrders.tsx`) opens the ready alert once per order from Home and the list.

**13 · Capacity + limit.** The migration adds both columns, and `insert_order` (same signature) locks the shop row and raises `slot_full` / `too_many_dishes`. `slotAvailability` greys out full slots and defaults to the first slot that fits. `buildOrder` enforces the limit (not for walk-ins or simulated orders). The cart warns. Both fields are in `/vendor/settings` and the whitelist.

**14 · Board + summary.** `sortByStart` (`lib/vendor/sort.ts`): release_at for pre-orders, otherwise queued_at. Badge "เริ่มเลย / เริ่ม 11:57". `/vendor/summary` shows today and 7 Bangkok days, a bar per day, top 5 menus and a simulated-orders toggle. Quick walk-ins are excluded from sales.
*Known mismatch:* the wait estimate still counts a released pre-order by its `queued_at` (its pay time), so it can sit ahead of a walk-in that the board shows above it. Unchanged on purpose.

**15 · Ratings, popular, random.** The migration adds `orders.shop_rating/rating_comment`, `shops.rating_avg/rating_count` (written only in `refresh_shop_stats`) and `submit_rating` (owner, picked-up orders only). Stars on the picked-up screen. The average shows on `ShopRow` at ≥ 3 ratings. The vendor summary shows comments without names. "เมนูยอดนิยม 14 วัน" (`lib/orders/popular.ts`) hides when there's no data. "สุ่มเมนู" (`lib/menu/pick.ts`, injected RNG).

**16 · Weak signal, install, dark.** `OfflineBanner` shows "ข้อมูลล่าสุดเมื่อ …". Vendor status taps made offline are queued (`lib/vendor/pending-taps.ts`), shown as "รอส่ง N รายการ", and replayed in order through `actSetOrderStatus`. Rejected replays are dropped with a toast. `InstallPrompt` (Android prompt, iOS links to the guide). Dark theme via `[data-theme='dark']` in `globals.css`, set before paint in `app/layout.tsx`, customer screens only, toggle on Home.

## Cut to ship fast (do later if needed)
- Smoke test not extended for `/orders` list or ratings.
- Dark mode not contrast-audited screen by screen. Filled buttons keep their light colours, and the text tokens are lightened.
- Popular menus check `is_available`/deleted, not ingredient stock.
- README / `PLAN.md` §7 demo script not updated.

## Phase 17 — Rehearse and retest (people)
- Run lint, typecheck, unit tests, `test:e2e`, all `check:phase*` and `check:v2`. Deploy a preview and run `PLAN.md` §7 on a laptop, an Android phone and an iPhone.
- Test round 2: at least 2 vendors and the canteen manager, on site. Same questions and the same 0–10 score (compare with +71). Use `/admin/stats` "อยู่ในช่วงที่บอก" to tune D4. Ask ปฏิพล about "more variety", and ask what คนละครึ่ง users expect.
