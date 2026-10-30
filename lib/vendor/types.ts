// Shapes shared by the vendor board loader and the vendor screens. No server-only imports.

export type VendorOrderStatus = 'queued' | 'cooking' | 'ready';
export type VendorOrderSource = 'app' | 'walk_in_quick' | 'walk_in_full' | 'simulated';

export interface VendorOrderItem {
  menuName: string;
  kitchenSummary: string;
  qty: number;
  note: string | null;
}

export interface VendorOrder {
  id: string;
  queueNo: number;
  queueLabel: string;
  customerName: string;
  source: VendorOrderSource;
  status: VendorOrderStatus;
  itemCount: number;
  totalSatang: number | null;
  allergyNote: string | null;
  items: VendorOrderItem[];
  /** Pre-order: collection time and when to start (releaseAt in the future = not released yet). */
  pickupAt: string | null;
  releaseAt: string | null;
  queuedAt: string;
  startedAt: string | null;
  readyAt: string | null;
  lastCalledAt: string | null;
}

export interface VendorBoardData {
  shopId: string;
  shopName: string;
  queuePrefix: string;
  isOpen: boolean;
  waitMode: 'auto' | 'manual';
  secondsPerItem: number;
  itemsInQueue: number;
  orders: VendorOrder[];
  /** Server clock when this was built, to correct a wrong device clock. */
  serverNow: string;
}
