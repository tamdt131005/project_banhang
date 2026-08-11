import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { addVariant, app, seedCategory, seedProduct, seedUsers } from './helpers.js';

describe('giỏ hàng', () => {
  it('bắt buộc đăng nhập', async () => {
    await request(app).get('/api/cart').expect(401);
  });

  it('cộng đúng tạm tính, phí ship và tổng', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, price: 159_000, stock: 200 });
    const { customer } = await seedUsers();

    const response = await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 3 })
      .expect(201);

    const cart = response.body.cart;
    expect(cart.itemCount).toBe(3);
    expect(cart.subtotal).toBe(477_000);
    expect(cart.shippingFee).toBe(env.SHIPPING_FEE);
    expect(cart.total).toBe(477_000 + env.SHIPPING_FEE);
  });

  it('giỏ trống thì không tính phí ship', async () => {
    const { customer } = await seedUsers();

    const response = await customer.get('/api/cart').expect(200);
    expect(response.body.cart.shippingFee).toBe(0);
    expect(response.body.cart.total).toBe(0);
  });

  it('thêm cùng sản phẩm hai lần thì cộng dồn số lượng, không tạo dòng mới', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 10 });
    const { customer } = await seedUsers();

    await customer.post('/api/cart/items').send({ variantId: product.variant.id, quantity: 2 }).expect(201);
    const response = await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 3 })
      .expect(201);

    expect(response.body.cart.items).toHaveLength(1);
    expect(response.body.cart.items[0].quantity).toBe(5);
  });

  it('cùng sản phẩm nhưng khác size/màu là hai dòng giỏ riêng', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 10 });
    const other = await addVariant(product.id, { size: 'L', color: 'Trắng', stock: 5 });
    const { customer } = await seedUsers();

    await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 1 })
      .expect(201);
    const response = await customer
      .post('/api/cart/items')
      .send({ variantId: other.id, quantity: 2 })
      .expect(201);

    const items = response.body.cart.items;
    expect(items).toHaveLength(2);
    expect(items.map((item: { size: string; color: string }) => `${item.size}/${item.color}`)).toEqual(
      ['M/Đen', 'L/Trắng'],
    );
  });

  it('chặn khi tổng số lượng vượt tồn kho', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 4 });
    const { customer } = await seedUsers();

    await customer.post('/api/cart/items').send({ variantId: product.variant.id, quantity: 3 }).expect(201);

    // Phần thêm (2) nhỏ hơn tồn kho (4) nhưng tổng (5) thì vượt.
    const response = await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 2 })
      .expect(409);

    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('đánh dấu món không còn bán được', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 5 });
    const { customer, admin } = await seedUsers();

    await customer.post('/api/cart/items').send({ variantId: product.variant.id, quantity: 2 }).expect(201);
    await admin.patch(`/api/admin/products/${product.id}`).send({ isActive: false }).expect(200);

    const response = await customer.get('/api/cart').expect(200);
    expect(response.body.cart.items[0].isAvailable).toBe(false);
    expect(response.body.cart.hasUnavailableItems).toBe(true);
  });

  it('không cho đụng vào giỏ của người khác', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id });
    const { customer, admin } = await seedUsers();

    const added = await customer
      .post('/api/cart/items')
      .send({ variantId: product.variant.id, quantity: 1 })
      .expect(201);
    const itemId = added.body.cart.items[0].id;

    // Admin cũng là một người dùng khác — quyền quản trị không mở giỏ người khác.
    await admin.patch(`/api/cart/items/${itemId}`).send({ quantity: 5 }).expect(404);
  });
});
