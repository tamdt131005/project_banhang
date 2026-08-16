import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { app, seedUsers } from './helpers.js';
import { bannerUpdateSchema } from '../src/modules/banners/banner.schema.js';

const createdFiles = new Set<string>();

async function makePng() {
  return sharp({ create: { width: 80, height: 40, channels: 3, background: '#d9482b' } })
    .png()
    .toBuffer();
}

afterEach(async () => {
  await Promise.all([...createdFiles].map((url) => fs.rm(path.join(process.cwd(), env.UPLOAD_DIR, path.basename(url)), { force: true })));
  createdFiles.clear();
});

describe('banner trang chủ', () => {
  it('chỉ công khai banner đang bật theo thứ tự ổn định', async () => {
    await prisma.banner.createMany({ data: [
      { name: 'Sau', imageUrl: '/uploads/sau.webp', altText: 'Sau', sortOrder: 2, isActive: true },
      { name: 'Trước', imageUrl: '/uploads/tru.webp', altText: 'Trước', sortOrder: 1, isActive: true },
      { name: 'Ẩn', imageUrl: '/uploads/an.webp', altText: 'Ẩn', sortOrder: 0, isActive: false },
    ] });

    const response = await request(app).get('/api/banners?placement=HOME_HERO').expect(200);
    expect(response.body.banners.map((banner: { name: string }) => banner.name)).toEqual(['Trước', 'Sau']);
  });

  it('admin tạo, sửa, thay ảnh và bật tắt được nhưng khách thường bị chặn', async () => {
    const { admin, customer } = await seedUsers();
    const created = await admin.post('/api/admin/banners')
      .field('name', 'Bộ sưu tập hè').field('altText', 'Người mẫu mặc áo hè')
      .field('linkUrl', '/san-pham').field('sortOrder', '3')
      .attach('image', await makePng(), 'banner.png').expect(201);
    createdFiles.add(created.body.banner.imageUrl);

    const id = created.body.banner.id as number;
    const updated = await admin.patch(`/api/admin/banners/${id}`)
      .send({ name: 'Bộ sưu tập mới', linkUrl: 'https://example.com', sortOrder: 1 }).expect(200);
    expect(updated.body.banner.name).toBe('Bộ sưu tập mới');

    const replaced = await admin.post(`/api/admin/banners/${id}/image`)
      .attach('image', await makePng(), 'new.png').expect(200);
    createdFiles.add(replaced.body.banner.imageUrl);
    expect(replaced.body.banner.imageUrl).not.toBe(created.body.banner.imageUrl);

    await admin.patch(`/api/admin/banners/${id}/active`).send({ isActive: false }).expect(200);
    await customer.get('/api/admin/banners').expect(403);
  });

  it('từ chối liên kết có scheme không an toàn', async () => {
    const { admin } = await seedUsers();
    const response = await admin.post('/api/admin/banners')
      .field('name', 'Không an toàn').field('altText', 'Ảnh')
      .field('linkUrl', 'javascript:alert(1)')
      .attach('image', await makePng(), 'banner.png').expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('chỉ phân loại đường dẫn nội bộ an toàn và vẫn nhận URL http(s)', () => {
    expect(bannerUpdateSchema.safeParse({ linkUrl: '/san-pham?sort=newest' }).success).toBe(true);
    expect(bannerUpdateSchema.safeParse({ linkUrl: 'https://example.com/banner' }).success).toBe(true);
    expect(bannerUpdateSchema.safeParse({ linkUrl: '/\\example.com' }).success).toBe(false);
    expect(bannerUpdateSchema.safeParse({ linkUrl: '/safe\njavascript:alert(1)' }).success).toBe(false);
  });

  it('update là partial thật sự và không tự thêm default của create', () => {
    expect(bannerUpdateSchema.parse({})).toEqual({});
    expect(bannerUpdateSchema.parse({ name: 'Banner mới' })).toEqual({ name: 'Banner mới' });
  });
});
