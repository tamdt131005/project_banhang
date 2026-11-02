import crypto from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  CUSTOMER,
  app,
  seedAddress,
  seedCategory,
  seedProduct,
  seedUsers,
  userIdByEmail,
} from './helpers.js';

/** Cấu hình giả; VNPAY không cần gọi mạng khi tạo URL nên không phải mock fetch. */
const VNPAY = {
  VNPAY_TMN_CODE: 'TESTTMN1',
  VNPAY_HASH_SECRET: 'vnpay-secret-test',
  VNPAY_PAYMENT_URL: 'https://vnpay.example.test/vpcpay.html',
  VNPAY_RETURN_URL: 'http://localhost:5173/thanh-toan/vnpay/ket-qua',
} as const;

const original = { ...env };

beforeEach(() => {
  Object.assign(env, VNPAY);
});

afterEach(() => {
  Object.assign(env, original);
});

/** Ký độc lập với code chính: query sắp xếp theo tên, mã hoá kiểu form (dấu cách thành "+"). */
function sign(params: Record<string, string>) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]!]);
  const data = new URLSearchParams(sorted).toString();
  return crypto.createHmac('sha512', VNPAY.VNPAY_HASH_SECRET).update(data).digest('hex');
}

/** Tham số VNPAY gửi về (IPN và return URL dùng chung bộ này), đã ký. */
function vnpayReply(fields: { txnRef: string; amount: number; responseCode?: string; transactionStatus?: string }) {
  const params: Record<string, string> = {
    vnp_Amount: String(fields.amount * 100),
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'VNP14226112',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: 'Thanh toan don hang',
    vnp_PayDate: '20261102170112',
    vnp_ResponseCode: fields.responseCode ?? '00',
    vnp_TmnCode: VNPAY.VNPAY_TMN_CODE,
    vnp_TransactionNo: '14226112',
    vnp_TransactionStatus: fields.transactionStatus ?? '00',
    vnp_TxnRef: fields.txnRef,
  };
  return { ...params, vnp_SecureHash: sign(params) };
}

async function placeVnpayOrder() {
  const category = await seedCategory();
  const product = await seedProduct({ categoryId: category.id, price: 159_000, stock: 10 });
  const { customer } = await seedUsers();
  const user = await userIdByEmail(CUSTOMER.email);
  const address = await seedAddress(user.id);
  await customer.post('/api/cart/items').send({ variantId: product.variant.id, quantity: 2 }).expect(201);

  const response = await customer
    .post('/api/orders')
    .send({ addressId: address.id, paymentMethod: 'VNPAY' })
    .expect(201);

  const paymentUrl = new URL(String(response.body.paymentUrl));
  const txnRef = paymentUrl.searchParams.get('vnp_TxnRef') ?? '';
  return { customer, order: response.body.order, paymentUrl, txnRef };
}

function paymentStatusOf(code: string) {
  return prisma.order
    .findUniqueOrThrow({ where: { code }, select: { paymentStatus: true } })
    .then((row) => row.paymentStatus);
}

describe('thanh toán VNPAY', () => {
  it('tạo đơn VNPAY trả URL thanh toán ký đúng HMAC-SHA512', async () => {
    const { order, paymentUrl, txnRef } = await placeVnpayOrder();

    expect(order.paymentMethod).toBe('VNPAY');
    expect(order.paymentStatus).toBe('UNPAID');
    expect(`${paymentUrl.origin}${paymentUrl.pathname}`).toBe(VNPAY.VNPAY_PAYMENT_URL);

    const params = Object.fromEntries(paymentUrl.searchParams);
    expect(params['vnp_Amount']).toBe(String(order.total * 100));
    expect(params['vnp_TmnCode']).toBe(VNPAY.VNPAY_TMN_CODE);
    expect(params['vnp_ReturnUrl']).toBe(VNPAY.VNPAY_RETURN_URL);
    expect(params['vnp_CreateDate']).toMatch(/^\d{14}$/);
    expect(params['vnp_ExpireDate']! > params['vnp_CreateDate']!).toBe(true);
    expect(params['vnp_IpAddr']!.length).toBeGreaterThanOrEqual(7);
    expect(txnRef.startsWith(`${order.code}_`)).toBe(true);

    const { vnp_SecureHash, ...signed } = params;
    expect(vnp_SecureHash).toBe(sign(signed));
  });

  it('IPN: sai chữ ký 97, lệch tiền 04, đúng thì 00 và PAID, gửi lại thì 02', async () => {
    const { order, txnRef } = await placeVnpayOrder();
    const reply = vnpayReply({ txnRef, amount: order.total });

    const tampered = await request(app)
      .get('/api/payments/vnpay/ipn')
      .query({ ...reply, vnp_Amount: '100000' })
      .expect(200);
    expect(tampered.body.RspCode).toBe('97');

    const wrongAmount = await request(app)
      .get('/api/payments/vnpay/ipn')
      .query(vnpayReply({ txnRef, amount: 1_000 }))
      .expect(200);
    expect(wrongAmount.body.RspCode).toBe('04');
    expect(await paymentStatusOf(order.code)).toBe('UNPAID');

    const ok = await request(app).get('/api/payments/vnpay/ipn').query(reply).expect(200);
    expect(ok.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(await paymentStatusOf(order.code)).toBe('PAID');

    const again = await request(app).get('/api/payments/vnpay/ipn').query(reply).expect(200);
    expect(again.body.RspCode).toBe('02');
    expect(await paymentStatusOf(order.code)).toBe('PAID');
  });

  it('trang kết quả: khách huỷ thì FAILED, thanh toán lại thành công thì PAID', async () => {
    const { customer, order, txnRef } = await placeVnpayOrder();

    const failed = await customer
      .post(`/api/orders/${order.code}/vnpay/verify`)
      .send({ params: vnpayReply({ txnRef, amount: order.total, responseCode: '24', transactionStatus: '02' }) })
      .expect(200);
    expect(failed.body.outcome).toBe('FAILED');
    expect(failed.body.order.paymentStatus).toBe('FAILED');

    const retry = await customer.post(`/api/orders/${order.code}/vnpay`).expect(200);
    const retryRef = new URL(String(retry.body.paymentUrl)).searchParams.get('vnp_TxnRef') ?? '';
    expect(retryRef).not.toBe(txnRef);

    const paid = await customer
      .post(`/api/orders/${order.code}/vnpay/verify`)
      .send({ params: vnpayReply({ txnRef: retryRef, amount: order.total }) })
      .expect(200);
    expect(paid.body.outcome).toBe('PAID');
    expect(paid.body.order.paymentStatus).toBe('PAID');
  });

  it('trang kết quả từ chối tham số bị sửa và giao dịch của đơn khác', async () => {
    const { customer, order, txnRef } = await placeVnpayOrder();
    const reply = vnpayReply({ txnRef, amount: order.total });

    const tampered = await customer
      .post(`/api/orders/${order.code}/vnpay/verify`)
      .send({ params: { ...reply, vnp_ResponseCode: '00', vnp_Amount: '100' } })
      .expect(400);
    expect(tampered.body.error.code).toBe('INVALID_SIGNATURE');

    const otherOrder = await customer
      .post(`/api/orders/DH00000000-99999/vnpay/verify`)
      .send({ params: reply })
      .expect(400);
    expect(otherOrder.body.error.code).toBe('VNPAY_ORDER_MISMATCH');
    expect(await paymentStatusOf(order.code)).toBe('UNPAID');
  });

  it('khách không tự huỷ được đơn VNPAY đã thanh toán', async () => {
    const { customer, order, txnRef } = await placeVnpayOrder();
    await request(app).get('/api/payments/vnpay/ipn').query(vnpayReply({ txnRef, amount: order.total })).expect(200);

    const response = await customer
      .post(`/api/orders/${order.code}/cancel`)
      .send({ reasonCode: 'CHANGED_MIND' })
      .expect(409);
    expect(response.body.error.code).toBe('ORDER_ALREADY_PAID');
  });

  it('chưa cấu hình VNPAY thì từ chối đặt đơn trước khi ghi database', async () => {
    Object.assign(env, { VNPAY_TMN_CODE: '', VNPAY_HASH_SECRET: '' });
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 5 });
    const { customer } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);
    await customer.post('/api/cart/items').send({ variantId: product.variant.id, quantity: 1 }).expect(201);

    await customer.post('/api/orders').send({ addressId: address.id, paymentMethod: 'VNPAY' }).expect(501);
    expect(await prisma.order.count()).toBe(0);
  });
});
