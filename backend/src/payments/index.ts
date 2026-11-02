import type { PaymentMethod } from '@prisma/client';
import { codProvider } from './cod.js';
import { momoProvider } from './momo.js';
import type { PaymentProvider } from './types.js';
import { vnpayProvider } from './vnpay.js';

const providers: Record<PaymentMethod, PaymentProvider> = {
  COD: codProvider,
  MOMO: momoProvider,
  VNPAY: vnpayProvider,
};

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  return providers[method];
}

export type { PaymentInitResult, PaymentOrderInfo, PaymentProvider } from './types.js';
