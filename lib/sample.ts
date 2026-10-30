// Phase 1 sample live state so every screen has something realistic to show.
// Menus and prices come from the YAML; queue counts, names and times here are sample only.
// Phase 4 replaces this with stats and orders from the database.

import {
  availableOptions,
  defaultSelections,
  ingredientMap,
  kitchenSummary,
  menuAvailability,
  unitPrice,
  validate,
  type IngredientMap,
  type Menu,
  type Selections,
  type Shop,
} from './menu';
import { queueLabel } from './format';
import { busyLevel, type BusyLevel } from './queue';

/** Fixed sample clock (Bangkok lunch rush) so server and client render the same times. */
export const SAMPLE_NOW = '2026-10-30T11:42:00+07:00';
export const SAMPLE_VENDOR_SHOP = 'jae-buek';

const SAMPLE_DISHES_IN_QUEUE: Record<string, number> = {
  'pi-som': 2,
  'tomyum-kaitoon': 2,
  'niao-kai': 4,
  namtok: 1,
  'jae-buek': 5,
};

export interface ShopStats {
  dishesInQueue: number;
  secondsPerItem: number;
  waitSeconds: number;
  busy: BusyLevel;
}

export function sampleStats(shop: Shop): ShopStats {
  const dishesInQueue = SAMPLE_DISHES_IN_QUEUE[shop.slug] ?? 0;
  const secondsPerItem = shop.manualSecondsPerItem;
  const waitSeconds = dishesInQueue * secondsPerItem;
  return { dishesInQueue, secondsPerItem, waitSeconds, busy: busyLevel(waitSeconds) };
}

export type SampleStatus = 'queued' | 'cooking' | 'ready' | 'picked_up';
export type SampleSource = 'app' | 'walk_in_quick' | 'walk_in_full' | 'simulated';

export interface SampleOrderItem {
  menuName: string;
  kitchenSummary: string;
  qty: number;
  note: string | null;
  unitPriceSatang: number;
  lineTotalSatang: number;
}

export interface SampleOrder {
  id: string;
  queueNo: number;
  queueLabel: string;
  customerName: string;
  source: SampleSource;
  status: SampleStatus;
  itemCount: number;
  totalSatang: number | null;
  allergyNote: string | null;
  items: SampleOrderItem[];
  queuedAt: string;
  startedAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
}

export function minutesFromSampleNow(minutes: number): string {
  return new Date(new Date(SAMPLE_NOW).getTime() + minutes * 60_000).toISOString();
}

/** Defaults, plus the cheapest valid picks for required groups without a default. */
function sampleSelections(menu: Menu, ing: IngredientMap, removeOne: boolean): Selections {
  const sel = defaultSelections(menu, ing);
  for (const g of menu.groups) {
    if ((sel[g.id]?.length ?? 0) < g.minSelect) {
      sel[g.id] = availableOptions(g, ing)
        .slice(0, g.minSelect)
        .map((o) => o.id);
    }
    if (removeOne && g.kind === 'remove' && g.options.length > 0) sel[g.id] = [g.options[0].id];
  }
  return sel;
}

function orderable(shop: Shop): { menus: Menu[]; ing: IngredientMap } {
  const ing = ingredientMap(shop.ingredients);
  const menus = shop.menus.filter(
    (m) =>
      menuAvailability(m, ing).available && validate(m, sampleSelections(m, ing, false), ing).ok,
  );
  return { menus, ing };
}

function item(menu: Menu, ing: IngredientMap, qty: number, removeOne = false): SampleOrderItem {
  const sel = validate(menu, sampleSelections(menu, ing, removeOne), ing).selections;
  const unit = unitPrice(menu, sel) ?? 0;
  return {
    menuName: menu.name,
    kitchenSummary: kitchenSummary(menu, sel),
    qty,
    note: null,
    unitPriceSatang: unit,
    lineTotalSatang: unit * qty,
  };
}

const NAMES = ['ฝ้าย', 'ต้น', 'มิ้นท์', 'บอส', 'ฝน', 'แพร', 'ภูมิ', 'ใบเตย', 'กันต์', 'ปาล์ม'];

// Board layout: 2 ready, 2 cooking, 6 waiting (one quick walk-in, one allergy, one repeat).
const PLAN: { status: SampleStatus; menu: number; qty: number; removeOne?: boolean }[] = [
  { status: 'ready', menu: 0, qty: 1 },
  { status: 'ready', menu: 1, qty: 1 },
  { status: 'cooking', menu: 2, qty: 1 },
  { status: 'cooking', menu: 0, qty: 1, removeOne: true },
  { status: 'queued', menu: -1, qty: 2 },
  { status: 'queued', menu: 1, qty: 1, removeOne: true },
  { status: 'queued', menu: 0, qty: 1 },
  { status: 'queued', menu: 2, qty: 2 },
  { status: 'queued', menu: 0, qty: 1 },
  { status: 'queued', menu: 1, qty: 1 },
];

export function sampleOrders(shop: Shop): SampleOrder[] {
  const { menus, ing } = orderable(shop);
  if (menus.length === 0) return [];
  return PLAN.map((p, i) => {
    const queueNo = 21 + i;
    const base = {
      id: `${shop.slug}-${queueNo}`,
      queueNo,
      queueLabel: queueLabel(shop.queuePrefix, queueNo),
      customerName: NAMES[i % NAMES.length],
      status: p.status,
      queuedAt: minutesFromSampleNow(-14 + i),
      startedAt:
        p.status === 'queued' ? null : minutesFromSampleNow(p.status === 'cooking' ? -2 : -8 + i),
      readyAt: p.status === 'ready' ? minutesFromSampleNow(i === 0 ? -6 : -1) : null,
      pickedUpAt: null,
    };
    if (p.menu < 0) {
      return {
        ...base,
        customerName: 'ลูกค้าหน้าร้าน',
        source: 'walk_in_quick' as const,
        itemCount: p.qty,
        totalSatang: null,
        allergyNote: null,
        items: [],
      };
    }
    const it = item(menus[p.menu % menus.length], ing, p.qty, p.removeOne);
    if (i === 7) it.note = 'แยกน้ำจิ้ม';
    return {
      ...base,
      source: 'app' as const,
      itemCount: it.qty,
      totalSatang: it.lineTotalSatang,
      allergyNote: i === 7 ? 'แพ้กุ้ง' : null,
      items: [it],
    };
  });
}
