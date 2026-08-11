import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CUSTOMER, app, createUser } from './helpers.js';

const OTHER = { email: 'nguoikhac@test.local', password: 'MatKhau@456' };

function failedLogin(email: string) {
  return request(app).post('/api/auth/login').send({ email, password: 'sai-mat-khau' });
}

describe('rate limit đăng nhập', () => {
  it('chặn ở lần thử thứ 11 trong cùng cửa sổ thời gian', async () => {
    await createUser(CUSTOMER);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await failedLogin(CUSTOMER.email).expect(401);
    }

    const blocked = await failedLogin(CUSTOMER.email).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('không khoá lây sang tài khoản khác cùng địa chỉ IP', async () => {
    await createUser(CUSTOMER);
    await createUser(OTHER);

    for (let attempt = 1; attempt <= 11; attempt += 1) {
      await failedLogin(CUSTOMER.email);
    }

    // Khoá đếm gồm cả email, nên người khác dùng chung đường mạng (văn phòng,
    // ký túc xá, quán net) vẫn đăng nhập bình thường.
    await request(app)
      .post('/api/auth/login')
      .send({ email: OTHER.email, password: OTHER.password })
      .expect(200);
  });

  it('đăng nhập thành công không tiêu tốn hạn mức', async () => {
    await createUser(CUSTOMER);

    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: CUSTOMER.email, password: CUSTOMER.password })
        .expect(200);
    }
  });
});
