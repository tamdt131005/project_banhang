import type { Server as HttpServer } from 'node:http';
import type { Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { Server as SocketServer } from 'socket.io';
import { env } from '../../config/env.js';
import { ACCESS_COOKIE } from '../../lib/cookies.js';
import { verifyAccessToken } from '../../lib/jwt.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { chatEvents } from './chat.events.js';

interface ChatSocketData {
  user: { id: number; email: string; role: Role };
}

type Ack = (result: { ok: true } | { ok: false; error: { code: string; message: string } }) => void;

function fail(ack: Ack | undefined, error: unknown) {
  if (!ack) return;
  if (error instanceof AppError) {
    ack({ ok: false, error: { code: error.code, message: error.message } });
    return;
  }
  ack({ ok: false, error: { code: 'INVALID_SOCKET_REQUEST', message: 'Yêu cầu realtime không hợp lệ.' } });
}

function conversationIdFrom(payload: unknown) {
  const id =
    typeof payload === 'object' && payload !== null
      ? (payload as { conversationId?: unknown }).conversationId
      : undefined;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    throw AppError.badRequest('INVALID_CONVERSATION_ID', 'Mã cuộc trò chuyện không hợp lệ.');
  }
  return id;
}

/** Attach Socket.IO to the same HTTP server used by Express. Socket commands never write data. */
export function attachChatSocket(httpServer: HttpServer) {
  const io = new SocketServer<Record<string, never>, Record<string, never>, Record<string, never>, ChatSocketData>(
    httpServer,
    { cors: { origin: env.CORS_ORIGIN, credentials: true } },
  );

  // Reuse the application's existing cookie-parser dependency for Engine.IO handshakes.
  io.engine.use(cookieParser());
  io.use((socket, next) => {
    const request = socket.request as typeof socket.request & {
      cookies?: Record<string, string | undefined>;
    };
    const token = request.cookies?.[ACCESS_COOKIE];
    if (!token) return next(new Error('UNAUTHORIZED'));
    try {
      const claims = verifyAccessToken(token);
      const id = Number(claims.sub);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('invalid subject');
      socket.data.user = { id, email: claims.email, role: claims.role };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('conversation:join', async (payload: unknown, ack?: Ack) => {
      try {
        const conversationId = conversationIdFrom(payload);
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { userId: true },
        });
        if (!conversation) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
        if (socket.data.user.role !== 'ADMIN' && conversation.userId !== socket.data.user.id) {
          throw AppError.forbidden();
        }
        await socket.join(`conversation:${conversationId}`);
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });

    socket.on('support:subscribe', async (ack?: Ack) => {
      try {
        if (socket.data.user.role !== 'ADMIN') throw AppError.forbidden();
        await socket.join('support:admins');
        ack?.({ ok: true });
      } catch (error) {
        fail(ack, error);
      }
    });
  });

  const unsubscribers = [
    chatEvents.subscribe('conversation.created', (payload) => {
      io.to(`conversation:${payload.conversation.id}`).emit('conversation.created', payload);
    }),
    chatEvents.subscribe('message.created', (payload) => {
      io.to(`conversation:${payload.message.conversationId}`).emit('message.created', payload);
    }),
    chatEvents.subscribe('support.requested', (payload) => {
      io.to('support:admins').emit('support.requested', payload);
      io.to(`conversation:${payload.conversation.id}`).emit('support.requested', payload);
    }),
    chatEvents.subscribe('support.accepted', (payload) => {
      io.to('support:admins').emit('support.accepted', payload);
      io.to(`conversation:${payload.conversation.id}`).emit('support.accepted', payload);
    }),
    chatEvents.subscribe('conversation.closed', (payload) => {
      io.to('support:admins').emit('conversation.closed', payload);
      io.to(`conversation:${payload.conversation.id}`).emit('conversation.closed', payload);
    }),
  ];
  httpServer.once('close', () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  });

  return io;
}
