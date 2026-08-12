import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { app } from './helpers.js';
import { ADMIN, createUser, CUSTOMER, loginAs, seedUsers, userIdByEmail } from './helpers.js';

describe('customer chat API', () => {
  test('authenticated customer can create an independent conversation', async () => {
    await request(app).post('/api/chat/conversations').expect(401);
    const { customer } = await seedUsers();
    const user = await userIdByEmail(CUSTOMER.email);

    const response = await customer.post('/api/chat/conversations').expect(201);

    expect(response.body.conversation).toMatchObject({
      userId: user.id,
      assignedAdminId: null,
      status: 'AI',
      closedAt: null,
    });
    expect(response.body.conversation.id).toEqual(expect.any(Number));
    const second = await customer.post('/api/chat/conversations').expect(201);
    expect(second.body.conversation.id).not.toBe(response.body.conversation.id);
  });

  test('customer messaging is owned, paginated, spoof-safe, and human request is idempotent', async () => {
    const { customer } = await seedUsers();
    await createUser({ email: 'other@test.local', password: 'Other@12345' });
    const other = await loginAs('other@test.local', 'Other@12345');
    const user = await userIdByEmail(CUSTOMER.email);
    const conversation = (await customer.post('/api/chat/conversations').expect(201)).body
      .conversation;

    const sent = await customer
      .post(`/api/chat/conversations/${conversation.id}/messages`)
      .send({ content: 'Tôi cần tư vấn size', senderType: 'ADMIN', senderUserId: 999 })
      .expect(201);

    expect(sent.body.message).toMatchObject({
      conversationId: conversation.id,
      senderType: 'USER',
      senderUserId: user.id,
      content: 'Tôi cần tư vấn size',
    });
    await other.get(`/api/chat/conversations/${conversation.id}/messages`).expect(404);

    const history = await customer
      .get(`/api/chat/conversations/${conversation.id}/messages?page=1&limit=10`)
      .expect(200);
    expect(history.body.messages).toHaveLength(1);
    expect(history.body.pagination).toMatchObject({ page: 1, limit: 10, total: 1 });

    const firstRequest = await customer
      .post(`/api/chat/conversations/${conversation.id}/request-admin`)
      .expect(200);
    const replay = await customer
      .post(`/api/chat/conversations/${conversation.id}/request-admin`)
      .expect(200);
    expect(firstRequest.body.conversation.status).toBe('WAITING_ADMIN');
    expect(firstRequest.body.message.senderType).toBe('SYSTEM');
    expect(replay.body.message.id).toBe(firstRequest.body.message.id);

    const finalHistory = await customer
      .get(`/api/chat/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(finalHistory.body.messages).toHaveLength(2);
  });

  test('one admin atomically accepts, exclusively replies, and closes the live conversation', async () => {
    const { customer, admin } = await seedUsers();
    await createUser({
      email: 'admin2@test.local',
      password: 'Admin2@12345',
      role: 'ADMIN',
    });
    const admin2 = await loginAs('admin2@test.local', 'Admin2@12345');
    const firstAdmin = await userIdByEmail(ADMIN.email);
    const secondAdmin = await userIdByEmail('admin2@test.local');
    const conversation = (await customer.post('/api/chat/conversations').expect(201)).body
      .conversation;
    await customer.post(`/api/chat/conversations/${conversation.id}/request-admin`).expect(200);

    await customer.get('/api/admin/chat/conversations').expect(403);
    const queue = await admin
      .get('/api/admin/chat/conversations?status=WAITING_ADMIN&page=1&limit=10')
      .expect(200);
    expect(queue.body.items.map((item: { id: number }) => item.id)).toContain(conversation.id);

    const accepts = await Promise.all([
      admin.post(`/api/admin/chat/conversations/${conversation.id}/accept`),
      admin2.post(`/api/admin/chat/conversations/${conversation.id}/accept`),
    ]);
    expect(accepts.map((response) => response.status).sort()).toEqual([200, 409]);

    const accepted = accepts.find((response) => response.status === 200)!;
    const assignedId = accepted.body.conversation.assignedAdminId as number;
    const assigned = assignedId === firstAdmin.id ? admin : admin2;
    const unassigned = assignedId === firstAdmin.id ? admin2 : admin;
    expect([firstAdmin.id, secondAdmin.id]).toContain(assignedId);

    await unassigned
      .post(`/api/admin/chat/conversations/${conversation.id}/messages`)
      .send({ content: 'Không được phép' })
      .expect(403);
    const reply = await assigned
      .post(`/api/admin/chat/conversations/${conversation.id}/messages`)
      .send({ content: 'Chào bạn, mình đang hỗ trợ đây.', senderUserId: 999 })
      .expect(201);
    expect(reply.body.message).toMatchObject({ senderType: 'ADMIN', senderUserId: assignedId });

    const detail = await assigned
      .get(`/api/admin/chat/conversations/${conversation.id}?page=1&limit=20`)
      .expect(200);
    expect(detail.body.messages).toHaveLength(3);

    const closed = await assigned
      .post(`/api/admin/chat/conversations/${conversation.id}/close`)
      .expect(200);
    expect(closed.body.conversation).toMatchObject({ status: 'CLOSED' });
    expect(closed.body.conversation.closedAt).toEqual(expect.any(String));
    await customer
      .post(`/api/chat/conversations/${conversation.id}/messages`)
      .send({ content: 'Tin nhắn muộn' })
      .expect(409);
    await assigned
      .post(`/api/admin/chat/conversations/${conversation.id}/messages`)
      .send({ content: 'Tin nhắn muộn' })
      .expect(409);
  });
});
