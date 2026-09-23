import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { verifyPassword } from '../src/lib/password.js';
import { ADMIN, CUSTOMER, app, seedUsers } from './helpers.js';

const STAFF = {
  email: 'staff@test.local',
  password: 'Initial@123',
  fullName: 'Nhân viên thử',
  permissions: ['ORDERS', 'INVENTORY'],
} as const;

describe('tài khoản nhân viên', () => {
  it('chỉ chủ shop tạo được nhân viên; một màn đăng nhập nhận diện đúng mọi vai trò', async () => {
    const { customer, admin } = await seedUsers();
    await customer.post('/api/admin/users/staff').send(STAFF).expect(403);

    const created = await admin.post('/api/admin/users/staff').send(STAFF).expect(201);
    expect(created.body.user.role).toBe('STAFF');
    expect(created.body.user).not.toHaveProperty('passwordHash');
    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: STAFF.email },
      include: { cart: true, staffPermissions: true },
    });
    expect(stored.cart).not.toBeNull();
    expect(await verifyPassword(STAFF.password, stored.passwordHash)).toBe(true);
    expect(stored.staffPermissions.map((item) => item.permission).sort()).toEqual(['INVENTORY', 'ORDERS']);

    await request(app).post('/api/auth/login')
      .send({ email: STAFF.email, password: STAFF.password }).expect(200);
    await request(app).post('/api/auth/login')
      .send({ email: CUSTOMER.email, password: CUSTOMER.password }).expect(200);
    await request(app).post('/api/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password }).expect(200);
  });

  it('không thể nâng tài khoản khách có sẵn thành nhân viên', async () => {
    const { admin } = await seedUsers();
    const customer = await prisma.user.findUniqueOrThrow({ where: { email: CUSTOMER.email } });
    const response = await admin.patch(`/api/admin/users/${customer.id}/access`)
      .send({ permissions: ['ORDERS'] }).expect(409);
    expect(response.body.error.code).toBe('NOT_STAFF');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).role).toBe('USER');
  });

  it('nhân viên đổi mật khẩu bằng mật khẩu cũ và các refresh token bị thu hồi', async () => {
    const { admin } = await seedUsers();
    await admin.post('/api/admin/users/staff').send(STAFF).expect(201);
    const employee = request.agent(app);
    await employee.post('/api/auth/login')
      .send({ email: STAFF.email, password: STAFF.password }).expect(200);

    await employee.patch('/api/auth/me/password')
      .send({ currentPassword: 'sai', newPassword: 'Changed@123' }).expect(400);
    await employee.patch('/api/auth/me/password')
      .send({ currentPassword: STAFF.password, newPassword: 'Changed@123' }).expect(204);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: STAFF.email } });
    expect(await verifyPassword('Changed@123', stored.passwordHash)).toBe(true);
    expect(await prisma.refreshToken.count({ where: { userId: stored.id, revokedAt: null } })).toBe(0);
    await request(app).post('/api/auth/login')
      .send({ email: STAFF.email, password: STAFF.password }).expect(401);
    await request(app).post('/api/auth/login')
      .send({ email: STAFF.email, password: 'Changed@123' }).expect(200);
  });
});
