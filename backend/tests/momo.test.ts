import crypto from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

/** Cấu hình giả: không có request nào thật sự đi ra MoMo vì fetch bị thay thế. */
const MOMO = {
  MOMO_PARTNER_CODE: 'MOMOTEST',
  MOMO_ACCESS_KEY: 'access-key-test',
  MOMO_SECRET_KEY: 'secret-key-test',
  MOMO_ENDPOINT: 'https://momo.example.test',
} as const;

const original = { ...env };
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  Object.assign(env, MOMO);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  Object.assign(env, original);
  vi.unstubAllGlobals();
});

function momoReplies(body: Record<string, unknown>) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
}

function hmac(raw: string) {
  return crypto.createHmac('sha256', MOMO.MOMO_SECRET_KEY).update(raw).digest('hex');
}

function sentBody(callIndex: number) {
  return JSON.parse(String(fetchMock.mock.calls[callIndex]![1]!.body)) as Record<string, string | number>;
}

/** Dựng sẵn khách có địa chỉ và giỏ hàng, rồi đặt một đơn MoMo (MoMo trả payUrl). */
async function placeMomoOrder() {
  const category = await seedCategory();
  const product = await seedProduct({ categoryId: category.id, price: 159_000, stock: 10 });
  const { customer } = await seedUsers();
  const user = await userIdByEmail(CUSTOMER.email);
  const address = await seedAddress(user.id);
  await customer.post('/api/cart/items').send({ variantId: product.variant.id, quantity: 2 }).expect(201);

  momoReplies({ resultCode: 0, message: 'Thành công.', payUrl: 'https://momo.example.test/pay/abc' });
  const response = await customer
    .post('/api/orders')
    .send({ addressId: address.id, paymentMethod: 'MOMO' })
    .expect(201);

  return { customer, product, order: response.body.order, body: response.body, momoOrderId: String(sentBody(0).orderId) };
}

function signedIpn(fields: { orderId: string; amount: number; resultCode: number }) {
  const payload = {
    partnerCode: MOMO.MOMO_PARTNER_CODE,
    orderId: fields.orderId,
    requestId: fields.orderId,
    amount: fields.amount,
    orderInfo: 'Thanh toan don hang',
    orderType: 'momo_wallet',
    transId: 4088878653,
    resultCode: fields.resultCode,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1721720663942,
    extraData: '',
  };
  const raw =
    `accessKey=${MOMO.MOMO_ACCESS_KEY}&amount=${payload.amount}&extraData=${payload.extraData}` +
    `&message=${payload.message}&orderId=${payload.orderId}&orderInfo=${payload.orderInfo}` +
    `&orderType=${payload.orderType}&partnerCode=${payload.partnerCode}&payType=${payload.payType}` +
    `&requestId=${payload.requestId}&responseTime=${payload.responseTime}` +
    `&resultCode=${payload.resultCode}&transId=${payload.transId}`;
  return { ...payload, signature: hmac(raw) };
}

function paymentStatusOf(code: string) {
  return prisma.order
    .findUniqueOrThrow({ where: { code }, select: { paymentStatus: true } })
    .then((row) => row.paymentStatus);
}

describe('thanh toán MoMo', () => {
  it('tạo đơn MoMo trả paymentUrl, ký đúng chuỗi create và vẫn giữ hàng', async () => {
    const { order, body, product } = await placeMomoOrder();

    expect(body.paymentUrl).toBe('https://momo.example.test/pay/abc');
    expect(order.paymentMethod).toBe('MOMO');
    expect(order.paymentStatus).toBe('UNPAID');

    expect(fetchMock.mock.calls[0]![0]).toBe('https://momo.example.test/v2/gateway/api/create');
    const sent = sentBody(0);
    expect(sent.amount).toBe(order.total);
    expect(String(sent.orderId).startsWith(`${order.code}_`)).toBe(true);
    const raw =
      `accessKey=${MOMO.MOMO_ACCESS_KEY}&amount=${sent.amount}&extraData=${sent.extraData}` +
      `&ipnUrl=${sent.ipnUrl}&orderId=${sent.orderId}&orderInfo=${sent.orderInfo}` +
      `&partnerCode=${sent.partnerCode}&redirectUrl=${sent.redirectUrl}` +
      `&requestId=${sent.requestId}&requestType=${sent.requestType}`;
    expect(sent.signature).toBe(hmac(raw));

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variant.id } });
    expect(variant.stock).toBe(8);
  });

  it('MoMo từ chối tạo giao dịch thì đơn vẫn được tạo và trả paymentError', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 5 });
    const { customer } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);
    await customer.post('/api/cart/items').send({ variantId: product.variant.id, quantity: 1 }).expect(201);

    momoReplies({ resultCode: 22, message: 'Số tiền không hợp lệ.' });
    const response = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'MOMO' })
      .expect(201);

    expect(response.body.paymentUrl).toBeUndefined();
    expect(response.body.paymentError).toContain('Số tiền không hợp lệ.');
    expect(await prisma.order.count()).toBe(1);
  });

  it('IPN sai chữ ký bị từ chối; IPN đúng chữ ký đánh dấu đã thanh toán', async () => {
    const { order, momoOrderId } = await placeMomoOrder();
    const ipn = signedIpn({ orderId: momoOrderId, amount: order.total, resultCode: 0 });

    await request(app)
      .post('/api/payments/momo/ipn')
      .send({ ...ipn, amount: 1_000 })
      .expect(400);
    expect(await paymentStatusOf(order.code)).toBe('UNPAID');

    await request(app).post('/api/payments/momo/ipn').send(ipn).expect(204);
    expect(await paymentStatusOf(order.code)).toBe('PAID');

    // MoMo có thể gửi lại IPN; gửi lại không được làm hỏng trạng thái.
    await request(app).post('/api/payments/momo/ipn').send(ipn).expect(204);
    expect(await paymentStatusOf(order.code)).toBe('PAID');
  });

  it('khách không tự huỷ được đơn MoMo đã thanh toán', async () => {
    const { customer, order, momoOrderId } = await placeMomoOrder();
    await request(app)
      .post('/api/payments/momo/ipn')
      .send(signedIpn({ orderId: momoOrderId, amount: order.total, resultCode: 0 }))
      .expect(204);

    const response = await customer
      .post(`/api/orders/${order.code}/cancel`)
      .send({ reasonCode: 'CHANGED_MIND' })
      .expect(409);

    expect(response.body.error.code).toBe('ORDER_ALREADY_PAID');
    const saved = await prisma.order.findUniqueOrThrow({ where: { code: order.code } });
    expect(saved.status).toBe('PENDING');
  });

  it('trang kết quả tự tra cứu MoMo: thất bại thì FAILED, thanh toán lại rồi thành công thì PAID', async () => {
    const { customer, order, momoOrderId } = await placeMomoOrder();

    momoReplies({ partnerCode: MOMO.MOMO_PARTNER_CODE, orderId: momoOrderId, amount: order.total, resultCode: 1006, message: 'Người dùng từ chối.' });
    const failed = await customer
      .post(`/api/orders/${order.code}/momo/verify`)
      .send({ momoOrderId })
      .expect(200);
    expect(failed.body.outcome).toBe('FAILED');
    expect(failed.body.order.paymentStatus).toBe('FAILED');
    expect(fetchMock.mock.calls[1]![0]).toBe('https://momo.example.test/v2/gateway/api/query');

    momoReplies({ resultCode: 0, payUrl: 'https://momo.example.test/pay/retry' });
    const retry = await customer.post(`/api/orders/${order.code}/momo`).expect(200);
    expect(retry.body.paymentUrl).toBe('https://momo.example.test/pay/retry');
    const retryOrderId = String(sentBody(2).orderId);
    expect(retryOrderId).not.toBe(momoOrderId);

    momoReplies({ partnerCode: MOMO.MOMO_PARTNER_CODE, orderId: retryOrderId, amount: order.total, resultCode: 0, message: 'Thành công.' });
    const paid = await customer
      .post(`/api/orders/${order.code}/momo/verify`)
      .send({ momoOrderId: retryOrderId })
      .expect(200);
    expect(paid.body.outcome).toBe('PAID');
    expect(paid.body.order.paymentStatus).toBe('PAID');

    // Đã thanh toán thì không mở thêm giao dịch mới.
    await customer.post(`/api/orders/${order.code}/momo`).expect(409);
  });
});
