import sharp from 'sharp';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  ADMIN,
  CUSTOMER,
  addVariant,
  app,
  seedAddress,
  seedCategory,
  seedProduct,
  seedUsers,
  userIdByEmail,
} from './helpers.js';

describe('số liệu tổng quan', () => {
  it('đếm đúng sản phẩm, tồn kho và phân loại đơn theo trạng thái', async () => {
    const category = await seedCategory('Áo thun');
    // Một biến thể sắp hết (3) và một biến thể hết sạch (0).
    const product = await seedProduct({ categoryId: category.id, name: 'Áo thun thử', stock: 3 });
    await addVariant(product.id, { size: 'L', stock: 0 });

    const { customer, admin } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);

    await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 1 })
      .expect(201);
    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    const response = await admin.get('/api/admin/stats').expect(200);
    const stats = response.body;

    expect(stats.catalog.products).toBe(1);
    expect(stats.catalog.variants).toBe(2);
    expect(stats.catalog.categories).toBe(1);

    // Đặt 1 món từ biến thể tồn 3 → còn 2 (thấp) + 1 biến thể hết hàng.
    expect(stats.stock.units).toBe(2);
    expect(stats.stock.low).toBe(1);
    expect(stats.stock.out).toBe(1);
    expect(stats.stock.threshold).toBe(5);

    expect(stats.orders.total).toBe(1);
    expect(stats.orders.pending).toBe(1);
    expect(stats.orders.delivered).toBe(0);

    // Chưa giao nên chưa tính doanh thu thực nhận, nhưng đang chạy thì có.
    expect(stats.revenue.delivered).toBe(0);
    expect(stats.revenue.inProgress).toBe(created.body.order.total);

    // Biểu đồ luôn đủ 7 mốc ngày kể cả ngày không có đơn nào.
    expect(stats.series).toHaveLength(7);
    expect(stats.series.at(-1).orders).toBe(1);

    expect(stats.recentOrders[0].code).toBe(created.body.order.code);
    expect(stats.lowStockVariants.length).toBe(2);
    // Ít nhất lên đầu để nhìn là biết cần nhập hàng nào trước.
    expect(stats.lowStockVariants[0].stock).toBe(0);
  });

  it('không tính đơn đã huỷ vào doanh thu', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 10 });
    const { customer, admin } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);

    await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 1 })
      .expect(201);
    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    await customer.post(`/api/orders/${created.body.order.code}/cancel`).expect(200);

    const stats = await admin.get('/api/admin/stats').expect(200);
    expect(stats.body.orders.cancelled).toBe(1);
    expect(stats.body.revenue.inProgress).toBe(0);
    expect(stats.body.revenue.last7Days).toBe(0);
    expect(stats.body.series.at(-1).orders).toBe(0);
  });

  it('chỉ quản trị viên xem được', async () => {
    await request(app).get('/api/admin/stats').expect(401);
    const { customer } = await seedUsers();
    await customer.get('/api/admin/stats').expect(403);
  });
});

describe('quản lý kho', () => {
  it('liệt kê theo biến thể, lọc hàng sắp hết và tìm theo tên sản phẩm', async () => {
    const category = await seedCategory();
    const shirt = await seedProduct({ categoryId: category.id, name: 'Sơ mi kho', stock: 2 });
    await addVariant(shirt.id, { size: 'L', stock: 50 });
    await seedProduct({ categoryId: category.id, name: 'Quần kho', stock: 1 });

    const { admin } = await seedUsers();

    const all = await admin.get('/api/admin/inventory').expect(200);
    expect(all.body.pagination.total).toBe(3);
    expect(all.body.threshold).toBe(5);
    // Mặc định sắp xếp tồn ít lên trước — việc gấp nhất nằm trên cùng.
    expect(all.body.items[0].stock).toBe(1);
    expect(all.body.items[0].product.name).toBe('Quần kho');
    expect(all.body.items.at(-1).stock).toBe(50);

    const low = await admin.get('/api/admin/inventory?lowOnly=true').expect(200);
    expect(low.body.pagination.total).toBe(2);

    const search = await admin.get('/api/admin/inventory?search=Sơ mi').expect(200);
    expect(search.body.pagination.total).toBe(2);
    expect(search.body.items.every((item: { product: { name: string } }) =>
      item.product.name === 'Sơ mi kho',
    )).toBe(true);
  });

  it('cập nhật tồn kho một biến thể và chặn số âm', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 4 });
    const { admin } = await seedUsers();

    const updated = await admin
      .patch(`/api/admin/inventory/${product.variant.id}`)
      .send({ stock: 42, expectedStock: 4, reason: 'Nhập thêm sau kiểm kê' })
      .expect(200);

    expect(updated.body.variant.stock).toBe(42);
    expect(updated.body.movement).toMatchObject({
      type: 'ADMIN_ADJUSTMENT',
      beforeStock: 4,
      afterStock: 42,
      delta: 38,
      reason: 'Nhập thêm sau kiểm kê',
    });
    const row = await prisma.productVariant.findUniqueOrThrow({
      where: { id: product.variant.id },
      select: { stock: true },
    });
    expect(row.stock).toBe(42);

    const movements = await admin
      .get(`/api/admin/inventory/${product.variant.id}/movements`)
      .expect(200);
    expect(movements.body.pagination.total).toBe(1);
    expect(movements.body.items[0].id).toBe(updated.body.movement.id);

    const stale = await admin
      .patch(`/api/admin/inventory/${product.variant.id}`)
      .send({ stock: 43, expectedStock: 4, reason: 'Ghi từ màn hình cũ' })
      .expect(409);
    expect(stale.body.error.code).toBe('STOCK_CHANGED');
    expect(stale.body.error.details.currentStock).toBe(42);

    const rejected = await admin
      .patch(`/api/admin/inventory/${product.variant.id}`)
      .send({ stock: -1, expectedStock: 42, reason: 'Kiểm tra validation' })
      .expect(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');

    await admin
      .patch('/api/admin/inventory/999999')
      .send({ stock: 1, expectedStock: 0, reason: 'Không tồn tại' })
      .expect(404);
  });

  it('khách hàng không sửa được tồn kho', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 4 });
    const { customer } = await seedUsers();

    await customer
      .patch(`/api/admin/inventory/${product.variant.id}`)
      .send({ stock: 999 })
      .expect(403);
  });
});

describe('quản lý khách hàng', () => {
  it('liệt kê kèm số đơn, tìm theo email và xem được hồ sơ đầy đủ', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 10, price: 100_000 });
    const { customer, admin } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);

    await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 2 })
      .expect(201);
    await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    const list = await admin.get('/api/admin/users').expect(200);
    expect(list.body.pagination.total).toBe(2);
    // Không bao giờ để lọt băm mật khẩu ra ngoài.
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');

    const found = await admin.get(`/api/admin/users?search=${CUSTOMER.email}`).expect(200);
    expect(found.body.items).toHaveLength(1);
    expect(found.body.items[0]._count.orders).toBe(1);

    const detail = await admin.get(`/api/admin/users/${user.id}`).expect(200);
    expect(detail.body.user.addresses).toHaveLength(1);
    expect(detail.body.user.orders).toHaveLength(1);
    // Đơn chưa giao nên chưa tính vào tổng chi tiêu.
    expect(detail.body.user.stats.deliveredOrders).toBe(0);
    expect(detail.body.user.stats.totalSpent).toBe(0);
  });

  it('nâng quyền được, nhưng không tự hạ quyền và không bỏ admin cuối cùng', async () => {
    const { admin } = await seedUsers();
    const customer = await userIdByEmail(CUSTOMER.email);
    const adminUser = await userIdByEmail(ADMIN.email);

    // Admin duy nhất tự hạ quyền mình → chặn.
    const self = await admin
      .patch(`/api/admin/users/${adminUser.id}/role`)
      .send({ role: 'USER' })
      .expect(400);
    expect(self.body.error.code).toBe('CANNOT_DEMOTE_SELF');

    const promoted = await admin
      .patch(`/api/admin/users/${customer.id}/role`)
      .send({ role: 'ADMIN' })
      .expect(200);
    expect(promoted.body.user.role).toBe('ADMIN');

    // Giờ có hai admin nên hạ quyền người kia được, phiên của họ bị thu hồi.
    await admin.patch(`/api/admin/users/${customer.id}/role`).send({ role: 'USER' }).expect(200);
    const live = await prisma.refreshToken.count({
      where: { userId: customer.id, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('buộc đăng xuất mọi phiên của một tài khoản', async () => {
    const { customer, admin } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);

    await customer.get('/api/auth/me').expect(200);

    const result = await admin.post(`/api/admin/users/${user.id}/revoke-sessions`).expect(200);
    expect(result.body.revoked).toBe(1);

    // Access token cũ vẫn còn hạn, nhưng refresh thì hết đường sống.
    await customer.post('/api/auth/refresh').expect(401);
  });

  it('khách hàng không xem được danh sách tài khoản', async () => {
    const { customer } = await seedUsers();
    await customer.get('/api/admin/users').expect(403);
    await request(app).get('/api/admin/users').expect(401);
  });
});

describe('đơn hàng phía admin', () => {
  it('tìm theo mã đơn, lọc theo tình trạng thanh toán và khoảng ngày', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 10 });
    const { customer, admin } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);

    await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 1 })
      .expect(201);
    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);
    const code: string = created.body.order.code;

    const byCode = await admin.get(`/api/admin/orders?search=${code}`).expect(200);
    expect(byCode.body.items).toHaveLength(1);

    // Tìm theo tên người mua cũng phải ra.
    const byName = await admin.get('/api/admin/orders?search=Khách').expect(200);
    expect(byName.body.items.length).toBeGreaterThan(0);

    const unpaid = await admin.get('/api/admin/orders?paymentStatus=UNPAID').expect(200);
    expect(unpaid.body.items).toHaveLength(1);
    const paid = await admin.get('/api/admin/orders?paymentStatus=PAID').expect(200);
    expect(paid.body.items).toHaveLength(0);

    // Khoảng ngày phải bao trọn ngày hôm nay, kể cả đơn đặt buổi tối.
    const today = new Date();
    const key = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`;
    const inRange = await admin.get(`/api/admin/orders?from=${key}&to=${key}`).expect(200);
    expect(inRange.body.items).toHaveLength(1);

    const outOfRange = await admin
      .get('/api/admin/orders?from=2020-01-01&to=2020-01-02')
      .expect(200);
    expect(outOfRange.body.items).toHaveLength(0);
  });

  it('đánh dấu đã thanh toán bằng tay và chặn đơn đã huỷ', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 10 });
    const { customer, admin } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);

    await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 1 })
      .expect(201);
    const created = await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);
    const orderId: number = created.body.order.id;

    const paid = await admin
      .patch(`/api/admin/orders/${orderId}/payment-status`)
      .send({ paymentStatus: 'PAID' })
      .expect(200);
    expect(paid.body.order.paymentStatus).toBe('PAID');

    // Gửi lại đúng giá trị cũ là thao tác thừa — báo rõ thay vì ghi đè im lặng.
    await admin
      .patch(`/api/admin/orders/${orderId}/payment-status`)
      .send({ paymentStatus: 'PAID' })
      .expect(409);

    await admin.patch(`/api/admin/orders/${orderId}/status`).send({ status: 'CANCELLED' }).expect(200);
    await admin
      .patch(`/api/admin/orders/${orderId}/payment-status`)
      .send({ paymentStatus: 'UNPAID' })
      .expect(200);
    const rejected = await admin
      .patch(`/api/admin/orders/${orderId}/payment-status`)
      .send({ paymentStatus: 'PAID' })
      .expect(409);
    expect(rejected.body.error.code).toBe('ORDER_CANCELLED');
  });

  it('thống kê có danh sách sản phẩm bán chạy', async () => {
    const category = await seedCategory();
    const product = await seedProduct({
      categoryId: category.id,
      name: 'Áo bán chạy',
      stock: 20,
    });
    const { customer, admin } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);
    const address = await seedAddress(user.id);

    await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 4 })
      .expect(201);
    await customer
      .post('/api/orders')
      .send({ addressId: address.id, paymentMethod: 'COD' })
      .expect(201);

    const stats = await admin.get('/api/admin/stats').expect(200);
    expect(stats.body.topProducts).toHaveLength(1);
    expect(stats.body.topProducts[0].name).toBe('Áo bán chạy');
    expect(stats.body.topProducts[0].quantity).toBe(4);
  });
});

describe('ảnh sản phẩm', () => {
  /** Ảnh PNG thật để qua được hàng rào giải mã của sharp. */
  function makePng(size = 40) {
    return sharp({
      create: { width: size, height: size, channels: 3, background: { r: 20, g: 20, b: 20 } },
    })
      .png()
      .toBuffer();
  }

  it('tải ảnh lên rồi đổi thứ tự — ảnh đầu danh sách thành ảnh bìa', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id });
    const { admin } = await seedUsers();

    const uploaded = await admin
      .post(`/api/admin/products/${product.id}/images`)
      .attach('images', await makePng(), 'a.png')
      .attach('images', await makePng(50), 'b.png')
      .expect(201);

    const [first, second] = uploaded.body.product.images as { id: number }[];
    expect(uploaded.body.product.images).toHaveLength(2);

    const reordered = await admin
      .patch(`/api/admin/products/${product.id}/images/order`)
      .send({ imageIds: [second!.id, first!.id] })
      .expect(200);

    expect(reordered.body.product.images.map((image: { id: number }) => image.id)).toEqual([
      second!.id,
      first!.id,
    ]);

    // Cửa hàng lấy ảnh bìa theo sortOrder nhỏ nhất — phải là ảnh vừa đưa lên đầu.
    const shopView = await request(app).get(`/api/products/${product.slug}`).expect(200);
    expect(shopView.body.product.images[0].id).toBe(second!.id);
  });

  it('từ chối danh sách thứ tự thiếu ảnh hoặc có id lạ', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id });
    const { admin } = await seedUsers();

    const uploaded = await admin
      .post(`/api/admin/products/${product.id}/images`)
      .attach('images', await makePng(), 'a.png')
      .attach('images', await makePng(50), 'b.png')
      .expect(201);

    const ids = (uploaded.body.product.images as { id: number }[]).map((image) => image.id);

    // Gửi thiếu một ảnh: ảnh vắng mặt sẽ chen ngang thứ tự nên phải chặn.
    const missing = await admin
      .patch(`/api/admin/products/${product.id}/images/order`)
      .send({ imageIds: [ids[0]] })
      .expect(400);
    expect(missing.body.error.code).toBe('IMAGE_SET_MISMATCH');

    await admin
      .patch(`/api/admin/products/${product.id}/images/order`)
      .send({ imageIds: [ids[0], 999999] })
      .expect(400);

    await admin
      .patch(`/api/admin/products/${product.id}/images/order`)
      .send({ imageIds: [ids[0], ids[0]] })
      .expect(400);
  });

  it('chỉ quản trị viên đổi được thứ tự ảnh', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id });
    const { customer } = await seedUsers();

    await customer
      .patch(`/api/admin/products/${product.id}/images/order`)
      .send({ imageIds: [1] })
      .expect(403);
  });
});
