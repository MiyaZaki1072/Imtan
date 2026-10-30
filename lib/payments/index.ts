import 'server-only';

import { demoProvider } from './demo';
import type { PaymentProvider } from './types';

export { confirmDemoPayment, demoPaymentsEnabled } from './demo';
export type { PaymentProvider, PaymentStatus } from './types';

/** The prototype has one provider. A real one is chosen here later. */
export function getPaymentProvider(): PaymentProvider {
  return demoProvider;
}
