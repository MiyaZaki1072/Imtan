// PaymentProvider interface (PLAN.md §5b). Only the `demo` provider is built.
// A real provider (PLAN.md §10) implements the same three methods.

export type PaymentStatus = 'pending' | 'confirmed' | 'expired' | 'abandoned' | 'refunded';

export interface PaymentProvider {
  readonly id: 'demo';
  /** Called once when an order is created, after insert_order() made the `payments` row. */
  createPayment(order: { id: string; amountSatang: number }): Promise<{ reference: string }>;
  getStatus(orderId: string): Promise<PaymentStatus | null>;
  /** Providers that confirm by callback implement this; the demo provider has none. */
  handleWebhook?(request: Request): Promise<Response>;
}
