import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { addVariant, app, seedCategory, seedProduct, seedUsers } from './helpers.js';

describe('danh sách sản phẩm công khai', () => {
  it('không trả sản phẩm đã ẩn', async () => {
    const category = await seedCategory();
    await seedProduct({ categoryId: category.id, name: 'Hàng đang bán' });
    await seedProduct({ categoryId: category.id, name: 'Hàng đã ẩn', isActive: false });

    const response = await request(app).get('/api/products').expect(200);

    expect(response.body.pagination.total).toBe(1);
    expect(response.body.items[0].name).toBe('Hàng đang bán');
  });

  it('lọc theo danh mục cha kéo theo cả sản phẩm của danh mục con', async () => {
    const parent = await seedCategory('Điện tử');
    const child = await seedCategory('Tai nghe', parent.id);
    const other = await seedCategory('Thời trang');

    await seedProduct({ categoryId: parent.id, name: 'Hàng ở danh mục cha' });
    await seedProduct({ categoryId: child.id, name: 'Hàng ở danh mục con' });
    await seedProduct({ categoryId: other.id, name: 'Hàng danh mục khác' });

    const response = await request(app)
      .get('/api/products')
      .query({ categoryId: parent.id })
      .expect(200);

    expect(response.body.pagination.total).toBe(2);
    const names = response.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(expect.arrayContaining(['Hàng ở danh mục cha', 'Hàng ở danh mục con']));
  });

  it('tìm theo tên và phân trang', async () => {
    const category = await seedCategory();
    await seedProduct({ categoryId: category.id, name: 'Laptop Acer' });
    await seedProduct({ categoryId: category.id, name: 'Laptop Asus' });
    await seedProduct({ categoryId: category.id, name: 'Bàn phím cơ' });

    const search = await request(app).get('/api/products').query({ search: 'Laptop' }).expect(200);
    expect(search.body.pagination.total).toBe(2);

    const paged = await request(app).get('/api/products').query({ limit: 2 }).expect(200);
    expect(paged.body.items).toHaveLength(2);
    expect(paged.body.pagination.totalPages).toBe(2);
  });

  it('lọc theo size chỉ trả sản phẩm còn hàng ở size đó', async () => {
    const category = await seedCategory();
    // Có size M còn hàng.
    await seedProduct({ categoryId: category.id, name: 'Áo có M', size: 'M', stock: 5 });
    // Có size M nhưng hết sạch — không được xuất hiện khi lọc M.
    await seedProduct({ categoryId: category.id, name: 'Áo M hết hàng', size: 'M', stock: 0 });
    // Chỉ có size L.
    await seedProduct({ categoryId: category.id, name: 'Áo chỉ có L', size: 'L', stock: 9 });

    const response = await request(app).get('/api/products').query({ size: 'M' }).expect(200);

    expect(response.body.pagination.total).toBe(1);
    expect(response.body.items[0].name).toBe('Áo có M');
  });

  it('lọc size + màu phải khớp trên CÙNG một biến thể', async () => {
    const category = await seedCategory();
    // Sản phẩm có M/Đen (hết hàng) và L/Trắng (còn hàng): lọc size=M màu=Trắng
    // không được khớp chéo giữa hai biến thể.
    const product = await seedProduct({
      categoryId: category.id,
      name: 'Áo hai biến thể',
      size: 'M',
      color: 'Đen',
      stock: 0,
    });
    await addVariant(product.id, { size: 'L', color: 'Trắng', stock: 4 });

    const crossed = await request(app)
      .get('/api/products')
      .query({ size: 'M', color: 'Trắng' })
      .expect(200);
    expect(crossed.body.pagination.total).toBe(0);

    const matched = await request(app)
      .get('/api/products')
      .query({ size: 'L', color: 'Trắng' })
      .expect(200);
    expect(matched.body.pagination.total).toBe(1);
  });

  it('filter-options trả size xếp đúng thứ tự và chỉ từ hàng đang bán', async () => {
    const category = await seedCategory();
    const visible = await seedProduct({ categoryId: category.id, size: 'M', color: 'Đen' });
    await addVariant(visible.id, { size: 'Freesize', color: 'Be' });
    await addVariant(visible.id, { size: '30', color: 'Xanh' });
    await addVariant(visible.id, { size: 'S', color: 'Đen' });
    // Sản phẩm ẩn — size XL của nó không được lộ ra chip lọc.
    await seedProduct({ categoryId: category.id, size: 'XL', isActive: false });

    const response = await request(app).get('/api/products/filter-options').expect(200);

    expect(response.body.sizes).toEqual(['S', 'M', '30', 'Freesize']);
    expect(response.body.colors).toEqual(expect.arrayContaining(['Be', 'Xanh', 'Đen']));
    expect(response.body.sizes).not.toContain('XL');
  });

  it('từ chối khoảng giá ngược', async () => {
    const response = await request(app)
      .get('/api/products')
      .query({ minPrice: 900_000, maxPrice: 100_000 })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('trang chi tiết coi sản phẩm đã ẩn như không tồn tại', async () => {
    const category = await seedCategory();
    await seedProduct({ categoryId: category.id, slug: 'hang-an', isActive: false });

    await request(app).get('/api/products/hang-an').expect(404);
  });
});

describe('quản trị sản phẩm', () => {
  it('khách thường không được tạo sản phẩm', async () => {
    const category = await seedCategory();
    const { customer } = await seedUsers();

    const response = await customer
      .post('/api/admin/products')
      .send({
        name: 'Hàng lậu',
        description: 'Không được phép tạo.',
        price: 1000,
        categoryId: category.id,
      })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('admin tạo được sản phẩm và slug bỏ dấu tiếng Việt', async () => {
    const category = await seedCategory();
    const { admin } = await seedUsers();

    const response = await admin
      .post('/api/admin/products')
      .send({
        name: 'Ấm đun nước Đại Việt',
        description: 'Mô tả sản phẩm.',
        price: 350_000,
        categoryId: category.id,
        variants: [
          { size: 'M', color: 'Đen', initialStock: 3 },
          { size: 'L', color: 'Đen', initialStock: 2 },
        ],
      })
      .expect(201);

    expect(response.body.product.slug).toBe('am-dun-nuoc-dai-viet');
    // Trường stock trả về là TỔNG các biến thể.
    expect(response.body.product.stock).toBe(5);
    expect(response.body.product.variants).toHaveLength(2);

    const firstVariant = response.body.product.variants[0];
    const movements = await admin
      .get(`/api/admin/inventory/${firstVariant.id}/movements`)
      .expect(200);
    expect(movements.body.items).toMatchObject([
      {
        type: 'INITIAL_STOCK',
        beforeStock: 0,
        afterStock: firstVariant.stock,
        delta: firstVariant.stock,
      },
    ]);
  });

  it('cập nhật biến thể bằng id ổn định và không cho ghi tồn kho hiện có', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 4 });
    const { admin } = await seedUsers();

    const updated = await admin
      .patch(`/api/admin/products/${product.id}`)
      .send({
        variants: [
          { id: product.variant.id, size: 'XL', color: 'Đen' },
          { size: 'L', color: 'Trắng', initialStock: 2 },
        ],
      })
      .expect(200);

    expect(updated.body.product.variants[0]).toMatchObject({
      id: product.variant.id,
      size: 'XL',
      stock: 4,
    });
    expect(updated.body.product.stock).toBe(6);

    const rejected = await admin
      .patch(`/api/admin/products/${product.id}`)
      .send({
        variants: [
          { id: product.variant.id, size: 'XL', color: 'Đen', stock: 999 },
          {
            id: updated.body.product.variants[1].id,
            size: 'L',
            color: 'Trắng',
          },
        ],
      })
      .expect(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
    expect(
      await prisma.productVariant.findUniqueOrThrow({ where: { id: product.variant.id } }),
    ).toMatchObject({ stock: 4 });

    const duplicateId = await admin
      .patch(`/api/admin/products/${product.id}`)
      .send({
        variants: [
          { id: product.variant.id, size: 'M', color: 'Đen' },
          { id: product.variant.id, size: 'XL', color: 'Trắng' },
        ],
      })
      .expect(400);
    expect(duplicateId.body.error.code).toBe('VALIDATION_ERROR');
    expect(duplicateId.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'variants.1.id' }),
      ]),
    );
  });

  it('chặn hard delete biến thể hoặc sản phẩm còn tồn kho', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 4 });
    const { admin } = await seedUsers();

    const variantRemoval = await admin
      .patch(`/api/admin/products/${product.id}`)
      .send({ variants: [{ size: 'L', color: 'Trắng', initialStock: 0 }] })
      .expect(409);
    expect(variantRemoval.body.error.code).toBe('STOCK_REMAINS');

    const productRemoval = await admin.delete(`/api/admin/products/${product.id}`).expect(409);
    expect(productRemoval.body.error.code).toBe('STOCK_REMAINS');

    await admin
      .patch(`/api/admin/inventory/${product.variant.id}`)
      .send({ stock: 0, expectedStock: 4, reason: 'Ngừng kinh doanh biến thể' })
      .expect(200);
    await admin.delete(`/api/admin/products/${product.id}`).expect(204);

    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
    const retired = await prisma.inventoryMovement.findUniqueOrThrow({
      where: { operationKey: `VARIANT_RETIRED:${product.variant.id}` },
    });
    expect(retired).toMatchObject({ type: 'VARIANT_RETIRED', variantId: null, afterStock: 0 });
  });

  it('không xoá biến thể nếu CAS tăng tồn kho thắng đồng thời', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 0 });
    const { admin } = await seedUsers();

    const [adjustment, deletion] = await Promise.all([
      admin
        .patch(`/api/admin/inventory/${product.variant.id}`)
        .send({ stock: 1, expectedStock: 0, reason: 'Race kiểm kê' }),
      admin.delete(`/api/admin/products/${product.id}`),
    ]);

    expect([
      [200, 409],
      [404, 204],
    ]).toContainEqual([adjustment.status, deletion.status]);

    if (adjustment.status === 200) {
      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: product.variant.id },
      });
      expect(variant.stock).toBe(1);
      expect(deletion.body.error.code).toBe('STOCK_REMAINS');
      expect(
        await prisma.inventoryMovement.count({
          where: { operationKey: `VARIANT_RETIRED:${product.variant.id}` },
        }),
      ).toBe(0);
      return;
    }

    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
    expect(
      await prisma.inventoryMovement.findUniqueOrThrow({
        where: { operationKey: `VARIANT_RETIRED:${product.variant.id}` },
      }),
    ).toMatchObject({ type: 'VARIANT_RETIRED', variantId: null });
  });

  it('serialize xoá sản phẩm với cập nhật thêm biến thể có tồn kho', async () => {
    const category = await seedCategory();
    const product = await seedProduct({ categoryId: category.id, stock: 0 });
    const { admin } = await seedUsers();

    const [update, deletion] = await Promise.all([
      admin.patch(`/api/admin/products/${product.id}`).send({
        variants: [
          { id: product.variant.id, size: product.variant.size, color: product.variant.color },
          { size: 'RACE', color: 'Đỏ', initialStock: 1 },
        ],
      }),
      admin.delete(`/api/admin/products/${product.id}`),
    ]);

    expect([
      [200, 409],
      [404, 204],
    ]).toContainEqual([update.status, deletion.status]);

    if (update.status === 200) {
      expect(update.body.product.stock).toBe(1);
      expect(deletion.body.error.code).toBe('STOCK_REMAINS');
      expect(await prisma.product.findUnique({ where: { id: product.id } })).not.toBeNull();
      return;
    }

    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
    expect(
      await prisma.inventoryMovement.count({
        where: { type: 'INITIAL_STOCK', sizeSnapshot: 'RACE' },
      }),
    ).toBe(0);
  });

  it('từ chối tạo sản phẩm không có biến thể nào', async () => {
    const category = await seedCategory();
    const { admin } = await seedUsers();

    const response = await admin
      .post('/api/admin/products')
      .send({
        name: 'Hàng không size',
        description: 'Thiếu biến thể.',
        price: 100_000,
        categoryId: category.id,
        variants: [],
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('admin thấy được cả sản phẩm đang ẩn', async () => {
    const category = await seedCategory();
    await seedProduct({ categoryId: category.id, isActive: false });
    const { admin } = await seedUsers();

    const response = await admin.get('/api/admin/products').expect(200);
    expect(response.body.pagination.total).toBe(1);
  });
});

describe('quản trị danh mục', () => {
  it('không cho xoá danh mục còn sản phẩm', async () => {
    const category = await seedCategory();
    await seedProduct({ categoryId: category.id });
    const { admin } = await seedUsers();

    const response = await admin.delete(`/api/admin/categories/${category.id}`).expect(409);
    expect(response.body.error.code).toBe('CATEGORY_HAS_PRODUCTS');
  });

  it('không cho tạo vòng lặp trong cây danh mục', async () => {
    const parent = await seedCategory('Cha');
    const child = await seedCategory('Con', parent.id);
    const { admin } = await seedUsers();

    const response = await admin
      .patch(`/api/admin/categories/${parent.id}`)
      .send({ parentId: child.id })
      .expect(400);

    expect(response.body.error.code).toBe('CATEGORY_CYCLE');
  });
});
