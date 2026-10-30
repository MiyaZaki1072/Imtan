// Shapes shared by server loaders and client screens. No server-only imports here.

export type OrderStatus =
  | 'awaiting_payment'
  | 'expired'
  | 'abandoned'
  | 'queued'
  | 'cooking'
  | 'ready'
  | 'picked_up'
  | 'cancelled';

export type WaitFeedback = 'faster' | 'accurate' | 'slower';

export interface OrderViewItem {
  menuName: string;
  kitchenSummary: string;
  qty: number;
  note: string | null;
}

/** One customer order with everything the order and pay screens need. */
export interface OrderViewData {
  id: string;
  shopId: string;
  shopSlug: string;
  shopName: string;
  /** Effective status: an unpaid order past its expiry already reads as `expired`. */
  status: OrderStatus;
  queueLabel: string | null;
  customerName: string;
  itemCount: number;
  totalSatang: number | null;
  items: OrderViewItem[];
  allergyNote: string | null;
  paymentExpiresAt: string | null;
  paidAt: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  lastCalledAt: string | null;
  feedback: WaitFeedback | null;
  /** The wait promised when the order got its number. */
  estimatedWaitSeconds: number | null;
  /** Dishes in front of this order (queued/cooking orders before it). */
  dishesAhead: number;
  secondsPerItem: number;
  /** Server clock when this was built; clients use it to correct for a wrong device clock. */
  serverNow: string;
}

export interface HomeShop {
  slug: string;
  name: string;
  category: string;
  isOpen: boolean;
  itemsInQueue: number;
  estWaitSeconds: number;
  busyLevel: 'ว่าง' | 'ปานกลาง' | 'แน่น';
}

export interface HomeMine {
  orderId: string;
  shopName: string;
  queueLabel: string | null;
  status: OrderStatus;
  waitSeconds: number | null;
}

export interface HomeData {
  userId: string;
  shops: HomeShop[];
  mine: HomeMine | null;
}
