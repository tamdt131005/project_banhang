import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  type Agent,
  CUSTOMER,
  addVariant,
  seedAddress,
  seedCategory,
  seedProduct,
  seedUsers,
  userIdByEmail,
} from './helpers.js';

/** Dựng sẵn: 1 khách có địa chỉ, 1 sản phẩm trong giỏ. */
async function readyToCheckout(options?: { stock?: number; price?: number; quantity?: number }) {
  const category = await seedCategory();
  const product = await seedProduct({
    categoryId: category.id,
    name: 'Cáp sạc nhanh',
    price: options?.price ?? 159_000,
    stock: options?.stock ?? 10,
  });

  const { customer, admin } = await seedUsers();
  const user = await userIdByEmail(CUSTOMER.email);
  const address = await seedAddress(user.id);

  await customer
    .post('/api/cart/items')
    .send({ variantId: product.variant.id, quantity: options?.quantity ?? 2 })
    .expect(201);

  return { customer, admin, product, address, userId: user.id };
}

/** Tồn kho của một biến thể — nơi duy nhất còn giữ số tồn thật. */
function variantStockOf(variantId: number) {
  return prisma.productVariant
    .findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } })
    .then((row) => row.stock);
}

describe('tạo đơn hàng', () => {
  it('trừ tồn kho, dọn giỏ và sinh mã đơn', async () => {
    const { customer, admin, product, address } = await readyToCheckout({ stock: 10, quantity: 2 });

    const response = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    const order = response.body.order;
    expect(order.code).toMatch(/^DH\d{8}-\d{5}$/);
    expect(order.status).toBe('PENDING');
    expect(order.paymentStatus).toBe('UNPAID');
    expect(order.subtotal).toBe(318_000);
    expect(order.total).toBe(318_000 + env.SHIPPING_FEE);
    expect(order.statusHistory).toMatchObject([
      { type: 'CREATED', fromStatus: null, toStatus: 'PENDING', actorType: 'CUSTOMER' },
    ]);

    expect(await variantStockOf(product.variant.id)).toBe(8);

    const movements = await admin
      .get(`/api/admin/inventory/${product.variant.id}/movements`)
      .expect(200);
    expect(movements.body.items).toMatchObject([
      {
        type: 'ORDER_RESERVED',
        beforeStock: 10,
        afterStock: 8,
        delta: -2,
        orderId: order.id,
      },
    ]);

    const cart = await customer.get('/api/cart').expect(200);
    expect(cart.body.cart.itemCount).toBe(0);
  });

  it('chụp lại tên và giá sản phẩm, giữ nguyên khi sản phẩm bị sửa sau đó', async () => {
    const { customer, admin, product, address } = await readyToCheckout({ price: 100_000 });

    await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    await admin
      .patch(`/api/admin/products/${product.id}`)
      .send({ name: 'Tên hoàn toàn mới', price: 999_000 })
      .expect(200);

    const orders = await customer.get('/api/orders').expect(200);
    const item = orders.body.items[0].items[0];
    expect(item.productName).toBe('Cáp sạc nhanh');
    expect(item.unitPrice).toBe(100_000);
    // Size và màu cũng là snapshot — đơn cũ không đổi khi biến thể bị sửa/xoá.
    expect(item.size).toBe('M');
    expect(item.color).toBe('Đen');
  });

  it('trừ tồn đúng biến thể được mua, biến thể khác giữ nguyên', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 10 });
    const other = await addVariant(product.id, { size: 'L', color: 'Trắng', stock: 7 });

    const { customer } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);

    await customer
      .post('/api/cart/items')
      .send({ variantId: other.id, quantity: 2 })
      .expect(201);

    await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    // Chỉ biến thể L Trắng bị trừ; M Đen của cùng sản phẩm không suy suyển.
    expect(await variantStockOf(other.id)).toBe(5);
    expect(await variantStockOf(product.variant.id)).toBe(10);
  });

  it('chụp lại địa chỉ giao, giữ nguyên khi khách xoá địa chỉ', async () => {
    const { customer, address } = await readyToCheckout();

    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    await customer.delete(`/api/addresses/${address.id}`).expect(204);

    const detail = await customer.get(`/api/orders/${created.body.order.code}`).expect(200);
    expect(detail.body.order.receiverName).toBe('Người nhận thử');
    expect(detail.body.order.shippingLine1).toBe('1 Đường Thử');
  });

  it('từ chối khi giỏ trống', async () => {
    const { customer, address, userId } = await readyToCheckout();
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });

    const response = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(400);

    expect(response.body.error.code).toBe('CART_EMPTY');
  });

  it('từ chối địa chỉ của người khác', async () => {
    const { customer, admin } = await readyToCheckout();
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@test.local' } });
    const foreign = await seedAddress(adminUser.id);
    void admin;

    const response = await customer
      .post('/api/orders')
      .send({ addressId: foreign.id, paymentMethod: 'COD' })
      .expect(400);

    expect(response.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it('chặn khi tồn kho tụt xuống dưới số lượng trong giỏ', async () => {
    const { customer, admin, product, address } = await readyToCheckout({
      stock: 10,
      quantity: 5,
    });

    // Admin hạ tồn kho biến thể sau khi khách đã bỏ vào giỏ qua inventory CAS.
    await admin
      .patch(`/api/admin/inventory/${product.variant.id}`)
      .send({ stock: 2, expectedStock: 10, reason: 'Mẫu kiểm kê trước checkout' })
      .expect(200);

    const response = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(409);

    expect(response.body.error.code).toBe('OUT_OF_STOCK');
    // Tồn kho không được đụng tới khi đơn thất bại.
    expect(await variantStockOf(product.variant.id)).toBe(2);
    expect(await prisma.order.count()).toBe(0);
  });

  it('rollback toàn bộ giữ hàng và audit nếu một biến thể trong đơn hết hàng', async () => {
    const { customer, admin, product, address } = await readyToCheckout({ stock: 10, quantity: 2 });
    const unavailable = await addVariant(product.id, { size: 'L', color: 'Trắng', stock: 2 });
    await customer
      .post('/api/cart/items')
      .send({ variantId: unavailable.id, quantity: 2 })
      .expect(201);
    await admin
      .patch(`/api/admin/inventory/${unavailable.id}`)
      .send({ stock: 1, expectedStock: 2, reason: 'Tồn thay đổi sau khi thêm vào giỏ' })
      .expect(200);

    const response = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(409);

    expect(response.body.error.code).toBe('OUT_OF_STOCK');
    expect(await variantStockOf(product.variant.id)).toBe(10);
    expect(await variantStockOf(unavailable.id)).toBe(1);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderStatusHistory.count()).toBe(0);
    expect(
      await prisma.inventoryMovement.count({ where: { type: 'ORDER_RESERVED' } }),
    ).toBe(0);
  });

  it('MoMo trả 501 và không tạo đơn hay trừ tồn kho', async () => {
    const { customer, product, address } = await readyToCheckout({ stock: 10, quantity: 2 });

    const response = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'MOMO' })
      .expect(501);

    expect(response.body.error.code).toBe('PAYMENT_NOT_IMPLEMENTED');
    expect(await variantStockOf(product.variant.id)).toBe(10);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe('xem và huỷ đơn', () => {
  it('không xem được đơn của người khác', async () => {
    const { customer, admin, address } = await readyToCheckout();
    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    // /api/orders/:code chỉ trả đơn của chính mình, kể cả với tài khoản admin.
    await admin.get(`/api/orders/${created.body.order.code}`).expect(404);
  });

  it('huỷ đơn chờ xác nhận thì hoàn lại tồn kho', async () => {
    const { customer, product, address } = await readyToCheckout({ stock: 10, quantity: 3 });
    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    expect(await variantStockOf(product.variant.id)).toBe(7);

    const cancelled = await customer
      .post(`/api/orders/${created.body.order.code}/cancel`)
      .expect(200);

    expect(cancelled.body.order.status).toBe('CANCELLED');
    expect(cancelled.body.replayed).toBe(false);
    expect(await variantStockOf(product.variant.id)).toBe(10);

    const replay = await customer
      .post(`/api/orders/${created.body.order.code}/cancel`)
      .expect(200);
    expect(replay.body.order.status).toBe('CANCELLED');
    expect(replay.body.replayed).toBe(true);
    expect(await variantStockOf(product.variant.id)).toBe(10);
  });

  it('không cho khách tự huỷ đơn đã xác nhận', async () => {
    const { customer, admin, address } = await readyToCheckout();
    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    await admin
      .patch(`/api/admin/orders/${created.body.order.id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200);

    const response = await customer
      .post(`/api/orders/${created.body.order.code}/cancel`)
      .expect(409);

    expect(response.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
  });
});

describe('quản trị đơn hàng', () => {
  async function placeOrder(): Promise<{
    admin: Agent;
    orderId: number;
    orderCode: string;
    variantId: number;
  }> {
    const { customer, admin, product, address } = await readyToCheckout({ stock: 10, quantity: 2 });
    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);
    return {
      admin,
      orderId: created.body.order.id,
      orderCode: created.body.order.code,
      variantId: product.variant.id,
    };
  }

  it('đi tới theo đúng luồng trạng thái', async () => {
    const { admin, orderId, orderCode } = await placeOrder();

    for (const status of ['CONFIRMED', 'SHIPPING', 'DELIVERED']) {
      const response = await admin
        .patch(`/api/admin/orders/${orderId}/status`)
        .send({ status })
        .expect(200);
      expect(response.body.order.status).toBe(status);
    }

    const detail = await admin.get(`/api/admin/orders/${orderCode}`).expect(200);
    expect(
      detail.body.order.statusHistory.map(
        (entry: { fromStatus: string | null; toStatus: string }) =>
          `${entry.fromStatus ?? 'null'}->${entry.toStatus}`,
      ),
    ).toEqual([
      'null->PENDING',
      'PENDING->CONFIRMED',
      'CONFIRMED->SHIPPING',
      'SHIPPING->DELIVERED',
    ]);
  });

  it('COD giao xong thì tự đánh dấu đã thanh toán', async () => {
    const { admin, orderId } = await placeOrder();

    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'CONFIRMED' });
    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'SHIPPING' });
    const delivered = await admin
      .patch(`/api/admin/orders/${orderId}/status`)
      .send({ status: 'DELIVERED' })
      .expect(200);

    expect(delivered.body.order.paymentStatus).toBe('PAID');
  });

  it('chặn đầy đủ các cạnh không có trong ma trận trạng thái admin', async () => {
    const { admin, orderId } = await placeOrder();

    async function rejects(status: string) {
      const response = await admin
        .patch(`/api/admin/orders/${orderId}/status`)
        .send({ status })
        .expect(409);
      expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    }

    await rejects('SHIPPING');
    await rejects('DELIVERED');

    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'CONFIRMED' }).expect(200);
    await rejects('PENDING');
    await rejects('DELIVERED');

    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'SHIPPING' }).expect(200);
    await rejects('PENDING');
    await rejects('CONFIRMED');
    await rejects('CANCELLED');

    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'DELIVERED' }).expect(200);
    for (const status of ['PENDING', 'CONFIRMED', 'SHIPPING', 'CANCELLED']) {
      await rejects(status);
    }
  });

  it('admin được huỷ từ CONFIRMED và tồn kho chỉ được hoàn một lần', async () => {
    const { admin, orderId, variantId } = await placeOrder();
    await admin
      .patch(`/api/admin/orders/${orderId}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200);

    const cancelled = await admin
      .patch(`/api/admin/orders/${orderId}/status`)
      .send({ status: 'CANCELLED' })
      .expect(200);
    expect(cancelled.body.order.status).toBe('CANCELLED');
    expect(cancelled.body.replayed).toBe(false);
    expect(await variantStockOf(variantId)).toBe(10);
  });

  it('10 yêu cầu huỷ đồng thời chỉ hoàn tồn và ghi audit đúng một lần', async () => {
    const { admin, orderId, variantId } = await placeOrder();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        admin
          .patch(`/api/admin/orders/${orderId}/status`)
          .send({ status: 'CANCELLED' })
          .expect(200),
      ),
    );

    expect(responses.filter((response) => response.body.replayed === false)).toHaveLength(1);
    expect(responses.filter((response) => response.body.replayed === true)).toHaveLength(9);
    expect(await variantStockOf(variantId)).toBe(10);
    expect(
      await prisma.orderStatusHistory.count({
        where: { orderId, type: 'TRANSITION', toStatus: 'CANCELLED' },
      }),
    ).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { orderId, variantId, type: 'ORDER_RESTORED' },
      }),
    ).toBe(1);
  });

  it('không cho huỷ đơn đang giao và trạng thái giao xong là terminal', async () => {
    const { admin, orderId } = await placeOrder();
    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'CONFIRMED' }).expect(200);
    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'SHIPPING' }).expect(200);

    const shippingCancel = await admin
      .patch(`/api/admin/orders/${orderId}/status`)
      .send({ status: 'CANCELLED' })
      .expect(409);
    expect(shippingCancel.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'DELIVERED' }).expect(200);
    const terminal = await admin
      .patch(`/api/admin/orders/${orderId}/status`)
      .send({ status: 'CANCELLED' })
      .expect(409);
    expect(terminal.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });
});
