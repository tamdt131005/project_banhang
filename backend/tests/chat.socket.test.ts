import { createServer } from 'node:http';
import request from 'supertest';
import { afterEach, describe, expect, test } from 'vitest';
import { createApp } from '../src/app.js';
import { attachChatSocket } from '../src/modules/chat/chat.socket.js';
import { createUser } from './helpers.js';

function accessCookie(headers: string[] | undefined) {
  const value = headers?.find((header) => header.startsWith('access_token='));
  if (!value) throw new Error('Login response did not set access_token');
  return value.split(';', 1)[0]!;
}

/** Minimal Engine.IO polling + Socket.IO default-namespace client using only Node's built-in fetch. */
class PollingSocket {
  private readonly queued: string[] = [];

  constructor(
    private readonly baseUrl: string,
    private readonly sid: string,
    private readonly cookie?: string,
  ) {}

  private url() {
    return `${this.baseUrl}/socket.io/?EIO=4&transport=polling&sid=${encodeURIComponent(this.sid)}&t=${Date.now()}-${Math.random()}`;
  }

  private headers(extra?: Record<string, string>) {
    return {
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...extra,
    };
  }

  async post(packet: string) {
    const response = await fetch(this.url(), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'text/plain;charset=UTF-8' }),
      body: packet,
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`Engine.IO POST failed: ${response.status}`);
  }

  private async poll() {
    const response = await fetch(this.url(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`Engine.IO poll failed: ${response.status}`);
    const packets = (await response.text()).split('\x1e').filter(Boolean);
    for (const packet of packets) {
      if (packet === '2') await this.post('3');
      else this.queued.push(packet);
    }
  }

  async waitFor(predicate: (packet: string) => boolean) {
    for (;;) {
      const index = this.queued.findIndex(predicate);
      if (index >= 0) return this.queued.splice(index, 1)[0]!;
      await this.poll();
    }
  }

  async connectPacket() {
    await this.post('40');
    return this.waitFor((packet) => packet.startsWith('40') || packet.startsWith('44'));
  }

  async emitWithAck(event: string, payload: unknown, ackId: number) {
    const args = payload === undefined ? [event] : [event, payload];
    await this.post(`42${ackId}${JSON.stringify(args)}`);
    const prefix = `43${ackId}`;
    const packet = await this.waitFor((candidate) => candidate.startsWith(prefix));
    return (JSON.parse(packet.slice(prefix.length)) as unknown[])[0];
  }

  async waitForEvent<T>(event: string): Promise<T> {
    const packet = await this.waitFor((candidate) => {
      if (!candidate.startsWith('42')) return false;
      const payload = JSON.parse(candidate.slice(2)) as unknown[];
      return payload[0] === event;
    });
    return (JSON.parse(packet.slice(2)) as [string, T])[1];
  }
}

async function openPolling(baseUrl: string, cookie?: string) {
  const response = await fetch(
    `${baseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}-${Math.random()}`,
    {
      headers: cookie ? { Cookie: cookie } : {},
      signal: AbortSignal.timeout(3_000),
    },
  );
  if (!response.ok) throw new Error(`Engine.IO handshake failed: ${response.status}`);
  const packet = await response.text();
  if (!packet.startsWith('0')) throw new Error(`Unexpected Engine.IO handshake: ${packet}`);
  const { sid } = JSON.parse(packet.slice(1)) as { sid: string };
  return new PollingSocket(baseUrl, sid, cookie);
}

describe('chat socket public seam', () => {
  const servers: Array<ReturnType<typeof attachChatSocket>> = [];

  afterEach(async () => {
    for (const server of servers) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    servers.length = 0;
  });

  test('cookie auth, per-room authorization, admin subscription, and committed delivery', async () => {
    const app = createApp();
    const httpServer = createServer(app);
    const io = attachChatSocket(httpServer);
    servers.push(io);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('HTTP server did not bind');
    const url = `http://127.0.0.1:${address.port}`;

    const anonymous = await openPolling(url);
    const authError = await anonymous.connectPacket();
    expect(authError.startsWith('44')).toBe(true);
    expect(JSON.parse(authError.slice(2))).toMatchObject({ message: 'UNAUTHORIZED' });

    await createUser({ email: 'socket-user@test.local', password: 'Socket@12345' });
    await createUser({ email: 'socket-other@test.local', password: 'Socket@12345' });
    await createUser({ email: 'socket-admin@test.local', password: 'Socket@12345', role: 'ADMIN' });

    const customerAgent = request.agent(app);
    const customerLogin = await customerAgent
      .post('/api/auth/login')
      .send({ email: 'socket-user@test.local', password: 'Socket@12345' })
      .expect(200);
    const otherAgent = request.agent(app);
    await otherAgent
      .post('/api/auth/login')
      .send({ email: 'socket-other@test.local', password: 'Socket@12345' })
      .expect(200);
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'socket-admin@test.local', password: 'Socket@12345' })
      .expect(200);
    const mine = (await customerAgent.post('/api/chat/conversations').expect(201)).body.conversation;
    const other = (await otherAgent.post('/api/chat/conversations').expect(201)).body.conversation;

    const customerAccessCookie = accessCookie(
      customerLogin.headers['set-cookie'] as unknown as string[],
    );
    const customerSocket = await openPolling(url, customerAccessCookie);
    expect((await customerSocket.connectPacket()).startsWith('40')).toBe(true);
    await expect(
      customerSocket.emitWithAck('conversation:join', { conversationId: mine.id }, 0),
    ).resolves.toEqual({ ok: true });
    await expect(
      customerSocket.emitWithAck('conversation:join', { conversationId: other.id }, 1),
    ).resolves.toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const adminSocket = await openPolling(
      url,
      accessCookie(adminLogin.headers['set-cookie'] as unknown as string[]),
    );
    expect((await adminSocket.connectPacket()).startsWith('40')).toBe(true);
    await expect(adminSocket.emitWithAck('support:subscribe', undefined, 0)).resolves.toEqual({
      ok: true,
    });

    const observedMessage = customerSocket
      .waitForEvent<{ message: { content: string } }>('message.created')
      .then(async (payload) => {
        // Read through the public REST seam as soon as the event arrives. If publication moves
        // before commit, this concurrent read can observe a history that is still missing it.
        const persisted = await request(app)
          .get(`/api/chat/conversations/${mine.id}/messages`)
          .set('Cookie', customerAccessCookie)
          .expect(200);
        return { payload, persistedTotal: persisted.body.pagination.total };
      });
    const triggerRequest = customerAgent
      .post(`/api/chat/conversations/${mine.id}/messages`)
      .send({ content: 'Socket sees committed message' })
      .expect(201);
    const [messageObservation] = await Promise.all([observedMessage, triggerRequest]);
    expect(messageObservation).toMatchObject({
      payload: { message: { content: 'Socket sees committed message' } },
      persistedTotal: 1,
    });

    const supportEvent = adminSocket.waitForEvent<{ conversation: { id: number } }>(
      'support.requested',
    );
    await customerAgent.post(`/api/chat/conversations/${mine.id}/request-admin`).expect(200);
    await expect(supportEvent).resolves.toMatchObject({ conversation: { id: mine.id } });
  });
});
