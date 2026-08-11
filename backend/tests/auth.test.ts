import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { CUSTOMER, app, createUser, loginAs } from './helpers.js';

describe('đăng ký', () => {
  it('tạo tài khoản và đặt cookie httpOnly cho cả access lẫn refresh', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Moi@Test.Local', password: 'MatKhau@123', fullName: 'Người Mới' })
      .expect(201);

    // Email được chuẩn hoá về chữ thường để "A@x.com" và "a@x.com" là một.
    expect(response.body.user.email).toBe('moi@test.local');
    expect(response.body.user.role).toBe('USER');
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const access = cookies.find((value) => value.startsWith('access_token='));
    const refresh = cookies.find((value) => value.startsWith('refresh_token='));

    expect(access).toContain('HttpOnly');
    expect(refresh).toContain('HttpOnly');
    // Refresh token chỉ đi kèm request tới /api/auth, không đính vào mọi nơi.
    expect(refresh).toContain('Path=/api/auth');
  });

  it('tạo sẵn giỏ hàng cho tài khoản mới', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'cogio@test.local', password: 'MatKhau@123', fullName: 'Có Giỏ' })
      .expect(201);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'cogio@test.local' },
      include: { cart: true },
    });
    expect(user.cart).not.toBeNull();
  });

  it('từ chối email đã tồn tại', async () => {
    await createUser(CUSTOMER);

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: CUSTOMER.email, password: 'MatKhau@123', fullName: 'Trùng Email' })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('báo lỗi từng trường bằng tiếng Việt', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'khong-phai-email', password: '123' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const fields = response.body.error.details.map((item: { field: string }) => item.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'fullName']));
    // Thông báo mặc định của zod phải là tiếng Việt, không lẫn tiếng Anh.
    expect(JSON.stringify(response.body)).not.toContain('Invalid input');
  });
});

describe('đăng nhập', () => {
  it('trả cùng một thông báo cho email lạ và sai mật khẩu', async () => {
    await createUser(CUSTOMER);

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: CUSTOMER.email, password: 'sai-mat-khau' })
      .expect(401);

    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khong-ton-tai@test.local', password: 'sai-mat-khau' })
      .expect(401);

    // Khác thông báo sẽ giúp kẻ tấn công dò được email nào đã có tài khoản.
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('phiên đăng nhập', () => {
  it('/me trả 401 khi chưa đăng nhập', async () => {
    const response = await request(app).get('/api/auth/me').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('đăng xuất làm mất hiệu lực phiên', async () => {
    await createUser(CUSTOMER);
    const agent = await loginAs(CUSTOMER.email, CUSTOMER.password);

    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('refresh xoay vòng token và thu hồi token cũ', async () => {
    await createUser(CUSTOMER);
    const agent = await loginAs(CUSTOMER.email, CUSTOMER.password);

    const before = await prisma.refreshToken.findMany({ orderBy: { id: 'asc' } });
    expect(before).toHaveLength(1);

    await agent.post('/api/auth/refresh').expect(200);

    const after = await prisma.refreshToken.findMany({ orderBy: { id: 'asc' } });
    expect(after).toHaveLength(2);
    expect(after[0]?.revokedAt).not.toBeNull();
    expect(after[1]?.revokedAt).toBeNull();
  });

  it('PATCH /me đổi họ tên, cập nhật rồi xoá được số điện thoại', async () => {
    await createUser(CUSTOMER);
    const agent = await loginAs(CUSTOMER.email, CUSTOMER.password);

    const updated = await agent
      .patch('/api/auth/me')
      .send({ fullName: 'Tên Mới', phone: '0901234567' })
      .expect(200);

    expect(updated.body.user.fullName).toBe('Tên Mới');
    expect(updated.body.user.phone).toBe('0901234567');
    expect(updated.body.user).not.toHaveProperty('passwordHash');

    // phone: null nghĩa là xoá số — /me sau đó phải phản ánh đúng.
    await agent.patch('/api/auth/me').send({ fullName: 'Tên Mới', phone: null }).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.phone).toBeNull();
  });

  it('PATCH /me bỏ qua email và role gửi kèm, không cho tự nâng quyền', async () => {
    await createUser(CUSTOMER);
    const agent = await loginAs(CUSTOMER.email, CUSTOMER.password);

    const response = await agent
      .patch('/api/auth/me')
      .send({ fullName: 'Tên Hợp Lệ', email: 'khac@test.local', role: 'ADMIN' })
      .expect(200);

    expect(response.body.user.email).toBe(CUSTOMER.email);
    expect(response.body.user.role).toBe('USER');
  });

  it('PATCH /me chặn số điện thoại sai định dạng và yêu cầu đăng nhập', async () => {
    await request(app).patch('/api/auth/me').send({ fullName: 'Ai Đó' }).expect(401);

    await createUser(CUSTOMER);
    const agent = await loginAs(CUSTOMER.email, CUSTOMER.password);

    const response = await agent
      .patch('/api/auth/me')
      .send({ fullName: 'Tên Hợp Lệ', phone: '12345' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('dùng lại refresh token đã thu hồi sẽ cắt sạch mọi phiên của tài khoản', async () => {
    const user = await createUser(CUSTOMER);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: CUSTOMER.email, password: CUSTOMER.password })
      .expect(200);

    const cookies = login.headers['set-cookie'] as unknown as string[];
    // Giữ lại bản sao token gốc để giả lập kẻ trộm dùng lại sau khi đã xoay vòng.
    const stolen = cookies.find((value) => value.startsWith('refresh_token='))!.split(';')[0]!;

    await request(app).post('/api/auth/refresh').set('Cookie', stolen).expect(200);

    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', stolen)
      .expect(401);
    expect(replay.body.error.code).toBe('UNAUTHORIZED');

    // Không chỉ chặn kẻ trộm — mọi phiên của tài khoản đều bị thu hồi, vì lúc
    // này không thể biết token nào đang nằm trong tay ai.
    const live = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(live).toBe(0);
  });
});

describe('ảnh đại diện', () => {
  /** Ảnh PNG thật do sharp sinh ra — qua được hàng rào giải mã ở lib/image. */
  function makePng() {
    return sharp({
      create: { width: 20, height: 32, channels: 3, background: { r: 217, g: 72, b: 43 } },
    })
      .png()
      .toBuffer();
  }

  function diskPath(avatarUrl: string) {
    return path.resolve(process.cwd(), env.UPLOAD_DIR, path.basename(avatarUrl));
  }

  it('upload rồi thay ảnh: ảnh cũ bị xoá khỏi đĩa, xoá avatar đưa về null', async () => {
    await createUser(CUSTOMER);
    const agent = await loginAs(CUSTOMER.email, CUSTOMER.password);

    const first = await agent
      .post('/api/auth/me/avatar')
      .attach('avatar', await makePng(), 'avatar.png')
      .expect(200);

    const firstUrl: string = first.body.user.avatarUrl;
    expect(firstUrl).toMatch(/^\/uploads\/avatar-[a-z0-9-]+\.webp$/);
    await expect(fs.access(diskPath(firstUrl))).resolves.toBeUndefined();

    // Đổi ảnh: bản mới thay thế và tệp cũ không được nằm lại thành rác.
    const second = await agent
      .post('/api/auth/me/avatar')
      .attach('avatar', await makePng(), 'avatar2.png')
      .expect(200);

    const secondUrl: string = second.body.user.avatarUrl;
    expect(secondUrl).not.toBe(firstUrl);
    await expect(fs.access(diskPath(firstUrl))).rejects.toThrow();

    // Xoá avatar: /me trả null và tệp biến mất khỏi đĩa.
    const removed = await agent.delete('/api/auth/me/avatar').expect(200);
    expect(removed.body.user.avatarUrl).toBeNull();
    await expect(fs.access(diskPath(secondUrl))).rejects.toThrow();

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.avatarUrl).toBeNull();
  });

  it('chặn tệp không giải mã được thành ảnh dù mimetype khai là ảnh', async () => {
    await createUser(CUSTOMER);
    const agent = await loginAs(CUSTOMER.email, CUSTOMER.password);

    const response = await agent
      .post('/api/auth/me/avatar')
      .attach('avatar', Buffer.from('khong phai anh'), {
        filename: 'gia.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_IMAGE');
  });

  it('yêu cầu đăng nhập và yêu cầu có tệp', async () => {
    await request(app).post('/api/auth/me/avatar').expect(401);

    await createUser(CUSTOMER);
    const agent = await loginAs(CUSTOMER.email, CUSTOMER.password);

    const response = await agent.post('/api/auth/me/avatar').expect(400);
    expect(response.body.error.code).toBe('NO_FILE');
  });
});
