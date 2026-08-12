import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { chatEvents } from './chat.events.js';
import type {
  AdminConversationListQuery,
  ChatMessageInput,
  MessageListQuery,
} from './chat.schema.js';

const SUPPORT_REQUESTED_CONTENT = 'Khách hàng đã yêu cầu hỗ trợ từ nhân viên.';

async function getOwnedConversation(userId: number, conversationId: number) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conversation) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
  return conversation;
}

export async function createConversation(userId: number) {
  const conversation = await prisma.conversation.create({
    data: { userId },
  });

  chatEvents.publish('conversation.created', { conversation });
  return conversation;
}

export async function listCustomerMessages(
  userId: number,
  conversationId: number,
  query: MessageListQuery,
) {
  await getOwnedConversation(userId, conversationId);
  const where = { conversationId };
  const [messages, total] = await prisma.$transaction([
    prisma.chatMessage.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.chatMessage.count({ where }),
  ]);
  return {
    messages,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function sendCustomerMessage(
  userId: number,
  conversationId: number,
  input: ChatMessageInput,
) {
  await getOwnedConversation(userId, conversationId);

  const result = await prisma.$transaction(async (tx) => {
    const writable = await tx.conversation.updateMany({
      where: { id: conversationId, userId, status: { not: 'CLOSED' } },
      data: { updatedAt: new Date() },
    });
    if (writable.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'USER',
        senderUserId: userId,
        content: input.content,
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    return { conversation, message };
  });

  if (!result) throw AppError.conflict('CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.');

  chatEvents.publish('message.created', { message: result.message });
  return result;
}

export async function requestAdmin(userId: number, conversationId: number) {
  const current = await getOwnedConversation(userId, conversationId);
  if (current.status === 'CLOSED') {
    throw AppError.conflict('CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.');
  }
  if (current.status === 'LIVE') {
    throw AppError.conflict('SUPPORT_ALREADY_LIVE', 'Nhân viên đang hỗ trợ cuộc trò chuyện này.');
  }

  const claimed = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.updateMany({
      where: { id: conversationId, userId, status: 'AI' },
      data: { status: 'WAITING_ADMIN' },
    });
    if (updated.count === 0) return null;

    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: SUPPORT_REQUESTED_CONTENT,
        metadata: { kind: 'SUPPORT_REQUESTED' },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    return { conversation, message };
  });

  if (claimed) {
    chatEvents.publish('message.created', { message: claimed.message });
    chatEvents.publish('support.requested', claimed);
    return claimed;
  }

  const conversation = await getOwnedConversation(userId, conversationId);
  if (conversation.status !== 'WAITING_ADMIN') {
    throw AppError.conflict('CONVERSATION_STATE_CHANGED', 'Trạng thái cuộc trò chuyện đã thay đổi.');
  }
  const message = await prisma.chatMessage.findFirst({
    where: { conversationId, senderType: 'SYSTEM', content: SUPPORT_REQUESTED_CONTENT },
    orderBy: { id: 'desc' },
  });
  if (!message) {
    throw AppError.conflict('SUPPORT_REQUEST_IN_PROGRESS', 'Yêu cầu hỗ trợ đang được xử lý.');
  }
  return { conversation, message };
}

const adminConversationInclude = {
  user: { select: { id: true, email: true, fullName: true } },
  assignedAdmin: { select: { id: true, email: true, fullName: true } },
} as const;

export async function listAdminConversations(query: AdminConversationListQuery) {
  const where = query.status === undefined ? {} : { status: query.status };
  const [items, total] = await prisma.$transaction([
    prisma.conversation.findMany({
      where,
      include: adminConversationInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.conversation.count({ where }),
  ]);
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getAdminConversation(conversationId: number, query: MessageListQuery) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: adminConversationInclude,
  });
  if (!conversation) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
  const where = { conversationId };
  const [messages, total] = await prisma.$transaction([
    prisma.chatMessage.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.chatMessage.count({ where }),
  ]);
  return {
    conversation,
    messages,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function acceptConversation(adminId: number, conversationId: number) {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.conversation.updateMany({
      where: { id: conversationId, status: 'WAITING_ADMIN', assignedAdminId: null },
      data: { status: 'LIVE', assignedAdminId: adminId },
    });
    if (claimed.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: 'Nhân viên hỗ trợ đã tiếp nhận cuộc trò chuyện.',
        metadata: { kind: 'SUPPORT_ACCEPTED', adminId },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    return { conversation, message };
  });

  if (!result) {
    const exists = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!exists) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
    throw AppError.conflict(
      'CONVERSATION_ALREADY_CLAIMED',
      'Cuộc trò chuyện đã được nhân viên khác tiếp nhận hoặc không còn chờ hỗ trợ.',
    );
  }

  chatEvents.publish('message.created', { message: result.message });
  chatEvents.publish('support.accepted', result);
  return result;
}

export async function sendAdminMessage(
  adminId: number,
  conversationId: number,
  input: ChatMessageInput,
) {
  const current = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!current) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
  if (current.status === 'CLOSED') {
    throw AppError.conflict('CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.');
  }
  if (current.status !== 'LIVE') {
    throw AppError.conflict('CONVERSATION_NOT_LIVE', 'Cuộc trò chuyện chưa được tiếp nhận.');
  }
  if (current.assignedAdminId !== adminId) {
    throw AppError.forbidden('Chỉ nhân viên đã tiếp nhận mới được trả lời cuộc trò chuyện này.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const writable = await tx.conversation.updateMany({
      where: { id: conversationId, status: 'LIVE', assignedAdminId: adminId },
      data: { updatedAt: new Date() },
    });
    if (writable.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'ADMIN',
        senderUserId: adminId,
        content: input.content,
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    return { conversation, message };
  });
  if (!result) {
    throw AppError.conflict('CONVERSATION_STATE_CHANGED', 'Trạng thái cuộc trò chuyện đã thay đổi.');
  }
  chatEvents.publish('message.created', { message: result.message });
  return result;
}

export async function closeConversation(adminId: number, conversationId: number) {
  const current = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!current) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
  if (current.status === 'CLOSED') {
    const message = await prisma.chatMessage.findFirst({
      where: { conversationId, senderType: 'SYSTEM', content: 'Cuộc trò chuyện đã được đóng.' },
      orderBy: { id: 'desc' },
    });
    if (!message) throw AppError.conflict('CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.');
    return { conversation: current, message };
  }
  if (current.status === 'WAITING_ADMIN') {
    throw AppError.conflict(
      'INVALID_CONVERSATION_TRANSITION',
      'Cuộc trò chuyện đang chờ tiếp nhận nên chưa thể đóng.',
    );
  }
  if (current.status === 'LIVE' && current.assignedAdminId !== adminId) {
    throw AppError.forbidden('Chỉ nhân viên đã tiếp nhận mới được đóng cuộc trò chuyện này.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.updateMany({
      where: { id: conversationId, status: current.status },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    if (updated.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: 'Cuộc trò chuyện đã được đóng.',
        metadata: { kind: 'CONVERSATION_CLOSED', adminId },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    return { conversation, message };
  });
  if (!result) {
    throw AppError.conflict('CONVERSATION_STATE_CHANGED', 'Trạng thái cuộc trò chuyện đã thay đổi.');
  }
  chatEvents.publish('message.created', { message: result.message });
  chatEvents.publish('conversation.closed', result);
  return result;
}
