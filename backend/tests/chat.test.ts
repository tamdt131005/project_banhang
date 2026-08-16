import { afterEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { app } from './helpers.js';
import {
  ADMIN,
  createUser,
  CUSTOMER,
  loginAs,
  seedCategory,
  seedProduct,
  seedUsers,
  userIdByEmail,
} from './helpers.js';
import type { AIProvider, AIProviderTurn, AIProviderTurnInput } from '../src/modules/chat/chat.ai.js';
import {
  drainAIResponsesForTests,
  setAIProviderForTests,
} from '../src/modules/chat/chat.ai.runtime.js';

class QueueAIProvider implements AIProvider {
  constructor(private readonly turns: AIProviderTurn[]) {}

  async generateTurn(_input: AIProviderTurnInput) {
    const next = this.turns.shift();
    if (!next) throw new Error('Fake AI provider ran out of turns');
    return next;
  }
}

class RecordingAIProvider extends QueueAIProvider {
  readonly inputs: AIProviderTurnInput[] = [];

  override async generateTurn(input: AIProviderTurnInput) {
    this.inputs.push(input);
    return super.generateTurn(input);
  }
}

class DeferredAIProvider implements AIProvider {
  private resolveTurn: ((value: AIProviderTurn) => void) | null = null;
  private resolveReady: () => void = () => {};

  readonly ready: Promise<void>;

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
  }

  async generateTurn(_input: AIProviderTurnInput) {
    this.resolveReady();
    return new Promise<AIProviderTurn>((resolve) => {
      this.resolveTurn = resolve;
    });
  }

  resolve(value: AIProviderTurn) {
    this.resolveTurn?.(value);
  }
}

afterEach(async () => {
  await drainAIResponsesForTests();
  setAIProviderForTests(null);
});

test('AI replies with trusted product cards from backend tools', async () => {
  const { customer } = await seedUsers();
  const category = await seedCategory('AI category');
  await seedProduct({
    categoryId: category.id,
    name: 'Ao AI goi y',
    slug: 'ao-ai-goi-y',
    price: 250_000,
    stock: 7,
    size: 'L',
    color: 'Den',
  });
  setAIProviderForTests(
    new QueueAIProvider([
      {
        toolCalls: [
          {
            id: 'call-1',
            name: 'searchProducts',
            args: { query: 'Ao AI', size: 'L', color: 'Den', limit: 1 },
          },
        ],
      },
      {
        text: JSON.stringify({
          message: 'Mau nay con hang va phu hop voi nhu cau cua ban.',
          products: [],
          suggestions: ['Xem chi tiet san pham'],
          handoffRecommended: false,
        }),
      },
    ]),
  );

  const conversation = (await customer.post('/api/chat/conversations').expect(201)).body
    .conversation;
  const sent = await customer
    .post(`/api/chat/conversations/${conversation.id}/messages`)
    .send({ content: 'Tim ao AI cho toi' })
    .expect(201);
  expect(sent.body.aiPending).toBe(true);

  await drainAIResponsesForTests();
  const history = await customer
    .get(`/api/chat/conversations/${conversation.id}/messages?page=1&limit=10`)
    .expect(200);
  expect(history.body.messages.map((message: { senderType: string }) => message.senderType)).toEqual([
    'USER',
    'AI',
  ]);
  expect(history.body.messages[1].metadata).toMatchObject({
    kind: 'AI_RESPONSE',
    products: [
      {
        slug: 'ao-ai-goi-y',
        price: 250_000,
        stock: 7,
        matchingVariants: [{ size: 'L', color: 'Den', available: true }],
      },
    ],
    suggestions: ['Xem chi tiet san pham'],
    handoffRecommended: false,
  });
});

test('return policy tool reports unavailable source of truth without inventing policy text', async () => {
  const { customer } = await seedUsers();
  const provider = new RecordingAIProvider([
    {
      toolCalls: [{ id: 'return-policy', name: 'getReturnPolicyStatus', args: {} }],
    },
    {
      text: JSON.stringify({
        message: 'Hien chua co thong tin chinh thuc ve chinh sach doi tra.',
        suggestions: ['Yeu cau nhan vien'],
        handoffRecommended: true,
      }),
    },
  ]);
  setAIProviderForTests(provider);

  const conversation = (await customer.post('/api/chat/conversations').expect(201)).body
    .conversation;
  await customer
    .post(`/api/chat/conversations/${conversation.id}/messages`)
    .send({ content: 'Shop doi size trong bao lau?' })
    .expect(201);
  await drainAIResponsesForTests();

  const toolResponseTurn = provider.inputs[1];
  const toolResponseMessage = toolResponseTurn?.messages.at(-1);
  expect(toolResponseMessage).toHaveProperty('toolResponses');
  if (!toolResponseMessage || !('toolResponses' in toolResponseMessage)) {
    throw new Error('Expected tool response message');
  }
  expect(toolResponseMessage.toolResponses[0]?.response).toMatchObject({
    configured: false,
    order: null,
  });
  expect(toolResponseMessage.toolResponses[0]?.response).not.toHaveProperty('policy');
});

test('customer receives AI_RESPONSE_PENDING while a fresh AI run owns the lease', async () => {
  const { customer } = await seedUsers();
  const provider = new DeferredAIProvider();
  setAIProviderForTests(provider);
  const conversation = (await customer.post('/api/chat/conversations').expect(201)).body
    .conversation;

  await customer
    .post(`/api/chat/conversations/${conversation.id}/messages`)
    .send({ content: 'Cau hoi dau' })
    .expect(201);
  await provider.ready;

  const blocked = await customer
    .post(`/api/chat/conversations/${conversation.id}/messages`)
    .send({ content: 'Cau hoi tiep theo' })
    .expect(409);
  expect(blocked.body.error.code).toBe('AI_RESPONSE_PENDING');

  provider.resolve({
    text: JSON.stringify({
      message: 'Da xu ly cau hoi dau.',
      suggestions: [],
      handoffRecommended: false,
    }),
  });
});

test('human handoff clears the AI lease and discards a late AI reply', async () => {
  const { customer } = await seedUsers();
  const provider = new DeferredAIProvider();
  setAIProviderForTests(provider);
  const conversation = (await customer.post('/api/chat/conversations').expect(201)).body
    .conversation;

  await customer
    .post(`/api/chat/conversations/${conversation.id}/messages`)
    .send({ content: 'Toi can nguoi ho tro' })
    .expect(201);
  await provider.ready;
  await customer.post(`/api/chat/conversations/${conversation.id}/request-admin`).expect(200);
  provider.resolve({
    text: JSON.stringify({
      message: 'Reply muon khong duoc luu.',
      suggestions: [],
      handoffRecommended: false,
    }),
  });
  await drainAIResponsesForTests();

  const history = await customer
    .get(`/api/chat/conversations/${conversation.id}/messages?page=1&limit=10`)
    .expect(200);
  expect(history.body.messages.map((message: { senderType: string }) => message.senderType)).toEqual([
    'USER',
    'SYSTEM',
  ]);
  expect(history.body.messages[1].metadata).toMatchObject({ kind: 'SUPPORT_REQUESTED' });
});

describe('customer chat API', () => {
  test('authenticated customer can create and list their conversations/tickets', async () => {
    await request(app).post('/api/chat/conversations').expect(401);
    await request(app).get('/api/chat/conversations').expect(401);
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

    const list = await customer.get('/api/chat/conversations?page=1&limit=10').expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.pagination.total).toBe(2);
    expect(list.body.items[0].id).toBe(second.body.conversation.id);
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

    const closed = await customer
      .post(`/api/chat/conversations/${conversation.id}/close`)
      .expect(200);
    expect(closed.body.conversation).toMatchObject({ status: 'CLOSED' });
    expect(closed.body.conversation.closedAt).toEqual(expect.any(String));

    const replayClosed = await customer
      .post(`/api/chat/conversations/${conversation.id}/close`)
      .expect(200);
    expect(replayClosed.body.conversation.status).toBe('CLOSED');
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

  test('AI handles wrapped JSON blocks and trailing commas without leaking raw JSON', async () => {
    const { customer } = await seedUsers();
    setAIProviderForTests(
      new QueueAIProvider([
        {
          text: `Dưới đây là câu trả lời của tôi:
\`\`\`json
{
  "message": "Chào bạn, áo thun bên mình có size từ S đến XL.",
  "suggestions": ["Xem bảng size", "Tư vấn thêm"],
  "handoffRecommended": false,
}
\`\`\`
Hy vọng thông tin này giúp ích cho bạn!`,
        },
      ]),
    );

    const conversation = (await customer.post('/api/chat/conversations').expect(201)).body
      .conversation;
    await customer
      .post(`/api/chat/conversations/${conversation.id}/messages`)
      .send({ content: 'Áo thun có những size nào?' })
      .expect(201);

    await drainAIResponsesForTests();
    const history = await customer
      .get(`/api/chat/conversations/${conversation.id}/messages?page=1&limit=10`)
      .expect(200);

    const aiMessage = history.body.messages.find(
      (msg: { senderType: string }) => msg.senderType === 'AI',
    );
    expect(aiMessage).toBeDefined();
    expect(aiMessage.content).toBe('Chào bạn, áo thun bên mình có size từ S đến XL.');
    expect(aiMessage.metadata.suggestions).toEqual(['Xem bảng size', 'Tư vấn thêm']);
  });
});
