import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { userHasPermission } from '../permissions/permission.service.js';
import {
  adminConversationSelect,
  conversationInternalSelect,
  conversationPublicSelect,
  customerConversationItemSelect,
  customerVisibleMessageWhere,
  type PublicConversation,
} from './chat.dto.js';
import {
  CONVERSATION_CLOSED_CONTENT,
  messageMetadataKind,
  STAFF_NOTE_KIND,
  STAFF_NOTE_PREFIX,
  SUPPORT_ACCEPTED_CONTENT,
  SUPPORT_CATEGORY_KIND,
  SUPPORT_CATEGORY_PREFIX,
  SUPPORT_REQUESTED_CONTENT,
  supportCategoryLabel,
  type SupportCategory,
} from './chat.constants.js';
import { chatEvents } from './chat.events.js';
import { isAIChatReady, queueAIResponse } from './chat.ai.runtime.js';
import type {
  AdminConversationListQuery,
  ChatMessageInput,
  CustomerConversationListQuery,
  MessageListQuery,
  SupportCategoryInput,
  SupportNoteInput,
  TransferConversationInput,
} from './chat.schema.js';

async function getOwnedConversation(userId: number, conversationId: number) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: conversationInternalSelect,
  });
  if (!conversation) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
  return conversation;
}

function staleAiCutoff() {
  return new Date(Date.now() - env.AI_CHAT_STALE_MS);
}

function hasFreshAiRun(conversation: Awaited<ReturnType<typeof getOwnedConversation>>) {
  return (
    conversation.activeAiRunId !== null &&
    conversation.activeAiRunStartedAt !== null &&
    conversation.activeAiRunStartedAt > staleAiCutoff()
  );
}

function toPublicConversation(
  conversation: Awaited<ReturnType<typeof getOwnedConversation>>,
): PublicConversation {
  const { activeAiRunId: _activeAiRunId, activeAiRunStartedAt: _activeAiRunStartedAt, ...rest } =
    conversation;
  return rest;
}

export async function createConversation(userId: number) {
  const conversation = await prisma.conversation.create({
    data: { userId },
    select: conversationPublicSelect,
  });

  chatEvents.publish('conversation.created', { conversation });
  return conversation;
}

export async function listCustomerConversations(
  userId: number,
  query: CustomerConversationListQuery,
) {
  const where: Prisma.ConversationWhereInput = {
    userId,
    ...(query.status === undefined ? {} : { status: query.status }),
  };
  const [items, total] = await prisma.$transaction([
    prisma.conversation.findMany({
      where,
      select: customerConversationItemSelect,
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

export async function listCustomerMessages(
  userId: number,
  conversationId: number,
  query: MessageListQuery,
) {
  await getOwnedConversation(userId, conversationId);
  const where = { conversationId, ...customerVisibleMessageWhere };
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
  const current = await getOwnedConversation(userId, conversationId);
  const shouldQueueAi = current.status === 'AI' && isAIChatReady();
  const aiRunId = shouldQueueAi ? crypto.randomUUID() : null;
  const aiRunStartedAt = shouldQueueAi ? new Date() : null;

  const result = await prisma.$transaction(async (tx) => {
    const where: Prisma.ConversationWhereInput = {
      id: conversationId,
      userId,
      status: { not: 'CLOSED' },
      ...(shouldQueueAi
        ? {
            status: 'AI',
            OR: [{ activeAiRunId: null }, { activeAiRunStartedAt: { lt: staleAiCutoff() } }],
          }
        : {}),
    };
    const writable = await tx.conversation.updateMany({
      where,
      data: {
        updatedAt: new Date(),
        ...(aiRunId
          ? { activeAiRunId: aiRunId, activeAiRunStartedAt: aiRunStartedAt }
          : {}),
      },
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
      select: conversationPublicSelect,
    });
    return { conversation, message, aiRunId };
  });

  if (!result) {
    const latest = await getOwnedConversation(userId, conversationId);
    if (latest.status === 'CLOSED') {
      throw AppError.conflict('CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.');
    }
    if (shouldQueueAi && latest.status === 'AI' && hasFreshAiRun(latest)) {
      throw AppError.conflict(
        'AI_RESPONSE_PENDING',
        'Trợ lý đang trả lời tin nhắn trước đó. Vui lòng chờ trong giây lát.',
      );
    }
    throw AppError.conflict('CONVERSATION_STATE_CHANGED', 'Trạng thái cuộc trò chuyện đã thay đổi.');
  }

  chatEvents.publish('message.created', { message: result.message });
  if (result.aiRunId) {
    queueAIResponse({
      conversationId,
      userId,
      runId: result.aiRunId,
      triggerMessageId: result.message.id,
    });
  }
  return {
    conversation: result.conversation,
    message: result.message,
    aiPending: result.aiRunId !== null,
  };
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
      data: { status: 'WAITING_ADMIN', activeAiRunId: null, activeAiRunStartedAt: null },
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
      select: conversationPublicSelect,
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
  return { conversation: toPublicConversation(conversation), message };
}

function adminConversationWhere(query: AdminConversationListQuery): Prisma.ConversationWhereInput {
  const filters: Prisma.ConversationWhereInput[] = [];
  if (query.status !== undefined) filters.push({ status: query.status });
  if (query.q) {
    const ticketId = Number(query.q.replace(/^#/, ''));
    const matches: Prisma.ConversationWhereInput[] = [
      { user: { fullName: { contains: query.q } } },
      { user: { email: { contains: query.q } } },
      { user: { phone: { contains: query.q } } },
    ];
    if (Number.isInteger(ticketId) && ticketId > 0) matches.push({ id: ticketId });
    filters.push({ OR: matches });
  }
  if (filters.length === 0) return {};
  if (filters.length === 1) return filters[0]!;
  return { AND: filters };
}

function readSupportCategory(metadata: Prisma.JsonValue | null): SupportCategory | null {
  if (messageMetadataKind(metadata) !== SUPPORT_CATEGORY_KIND) return null;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null;
  const category = (metadata as { category?: unknown }).category;
  return typeof category === 'string' ? (category as SupportCategory) : null;
}

export async function listAdminConversations(query: AdminConversationListQuery) {
  const where = adminConversationWhere(query);
  const [items, total] = await prisma.$transaction([
    prisma.conversation.findMany({
      where,
      select: adminConversationSelect,
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
    select: adminConversationSelect,
  });
  if (!conversation) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
  const where = { conversationId, ...customerVisibleMessageWhere };
  const noteWhere = {
    conversationId,
    senderType: 'SYSTEM' as const,
    content: { startsWith: STAFF_NOTE_PREFIX },
  };
  const [messages, total, notes, categoryMessage, customer] = await prisma.$transaction([
    prisma.chatMessage.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.chatMessage.count({ where }),
    prisma.chatMessage.findMany({
      where: noteWhere,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { sender: { select: { id: true, email: true, fullName: true } } },
    }),
    prisma.chatMessage.findFirst({
      where: {
        conversationId,
        senderType: 'SYSTEM',
        content: { startsWith: SUPPORT_CATEGORY_PREFIX },
      },
      orderBy: [{ id: 'desc' }],
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: conversation.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            fullName: true,
            phone: true,
            line1: true,
            ward: true,
            district: true,
            province: true,
          },
        },
        orders: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 3,
          select: { id: true, code: true, status: true, total: true, createdAt: true },
        },
      },
    }),
  ]);
  const category = readSupportCategory(categoryMessage?.metadata ?? null);
  return {
    conversation,
    messages,
    notes: notes.map((note) => ({
      id: note.id,
      content: note.content.slice(STAFF_NOTE_PREFIX.length),
      createdAt: note.createdAt,
      author: note.sender,
    })),
    classification: category
      ? { category, label: supportCategoryLabel(category) }
      : null,
    customer: {
      id: customer.id,
      email: customer.email,
      fullName: customer.fullName,
      phone: customer.phone,
      address: customer.addresses[0] ?? null,
      orders: customer.orders,
    },
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
      data: {
        status: 'LIVE',
        assignedAdminId: adminId,
        activeAiRunId: null,
        activeAiRunStartedAt: null,
      },
    });
    if (claimed.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: SUPPORT_ACCEPTED_CONTENT,
        metadata: { kind: 'SUPPORT_ACCEPTED', adminId },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: conversationPublicSelect,
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
      select: conversationPublicSelect,
    });
    return { conversation, message };
  });
  if (!result) {
    throw AppError.conflict('CONVERSATION_STATE_CHANGED', 'Trạng thái cuộc trò chuyện đã thay đổi.');
  }
  chatEvents.publish('message.created', { message: result.message });
  return result;
}

async function requireHandledConversation(adminId: number, conversationId: number) {
  const current = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!current) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
  if (current.status === 'CLOSED') {
    throw AppError.conflict('CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.');
  }
  if (current.status !== 'LIVE' || current.assignedAdminId !== adminId) {
    throw AppError.forbidden('Chỉ nhân viên đã tiếp nhận mới được thao tác cuộc trò chuyện này.');
  }
  return current;
}

export async function classifyConversation(
  adminId: number,
  conversationId: number,
  input: SupportCategoryInput,
) {
  const label = supportCategoryLabel(input.category);
  const result = await prisma.$transaction(async (tx) => {
    const writable = await tx.conversation.updateMany({
      where: { id: conversationId, status: 'LIVE', assignedAdminId: adminId },
      data: { updatedAt: new Date() },
    });
    if (writable.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: `${SUPPORT_CATEGORY_PREFIX}${label}`,
        metadata: { kind: SUPPORT_CATEGORY_KIND, category: input.category, adminId },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: conversationPublicSelect,
    });
    return { conversation, message };
  });
  if (!result) {
    await requireHandledConversation(adminId, conversationId);
    throw AppError.conflict('CONVERSATION_STATE_CHANGED', 'Trạng thái cuộc trò chuyện đã thay đổi.');
  }
  chatEvents.publish('message.created', { message: result.message });
  return { ...result, classification: { category: input.category, label } };
}

export async function addConversationNote(
  adminId: number,
  conversationId: number,
  input: SupportNoteInput,
) {
  const current = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });
  if (!current) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderType: 'SYSTEM',
      senderUserId: adminId,
      content: `${STAFF_NOTE_PREFIX}${input.content}`,
      metadata: { kind: STAFF_NOTE_KIND, authorId: adminId },
    },
    include: { sender: { select: { id: true, email: true, fullName: true } } },
  });
  chatEvents.publish('message.created', { message });
  return {
    note: {
      id: message.id,
      content: input.content,
      createdAt: message.createdAt,
      author: message.sender,
    },
  };
}

export async function listSupportAgents() {
  const agents = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'ADMIN' },
        { role: 'STAFF', staffPermissions: { some: { permission: 'SUPPORT' } } },
      ],
    },
    select: { id: true, email: true, fullName: true },
    orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
  });
  return { agents };
}

export async function transferConversation(
  adminId: number,
  conversationId: number,
  input: TransferConversationInput,
) {
  if (input.assigneeId === adminId) {
    throw AppError.badRequest('TRANSFER_TO_SELF', 'Hãy chọn một nhân viên hỗ trợ khác.');
  }
  await requireHandledConversation(adminId, conversationId);
  if (!(await userHasPermission(input.assigneeId, 'SUPPORT'))) {
    throw AppError.badRequest('ASSIGNEE_NOT_SUPPORT', 'Người nhận không có quyền hỗ trợ khách hàng.');
  }
  const assignee = await prisma.user.findUnique({
    where: { id: input.assigneeId },
    select: { id: true, fullName: true, email: true },
  });
  if (!assignee) {
    throw AppError.badRequest('ASSIGNEE_NOT_SUPPORT', 'Người nhận không có quyền hỗ trợ khách hàng.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.conversation.updateMany({
      where: { id: conversationId, status: 'LIVE', assignedAdminId: adminId },
      data: { assignedAdminId: assignee.id },
    });
    if (moved.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: `Cuộc trò chuyện đã được chuyển cho ${assignee.fullName || assignee.email}.`,
        metadata: { kind: 'SUPPORT_TRANSFERRED', fromAdminId: adminId, toAdminId: assignee.id },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: conversationPublicSelect,
    });
    return { conversation, message };
  });
  if (!result) {
    throw AppError.conflict('CONVERSATION_STATE_CHANGED', 'Trạng thái cuộc trò chuyện đã thay đổi.');
  }
  chatEvents.publish('message.created', { message: result.message });
  chatEvents.publish('support.transferred', result);
  return result;
}

export async function closeConversation(adminId: number, conversationId: number) {
  const current = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: conversationInternalSelect,
  });
  if (!current) throw AppError.notFound('Không tìm thấy cuộc trò chuyện này.');
  if (current.status === 'CLOSED') {
    const message = await prisma.chatMessage.findFirst({
      where: { conversationId, senderType: 'SYSTEM', content: CONVERSATION_CLOSED_CONTENT },
      orderBy: { id: 'desc' },
    });
    if (!message) throw AppError.conflict('CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.');
    return { conversation: toPublicConversation(current), message };
  }
  if (current.status === 'LIVE' && current.assignedAdminId !== adminId) {
    throw AppError.forbidden('Chỉ nhân viên đã tiếp nhận mới được đóng cuộc trò chuyện này.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.updateMany({
      where: { id: conversationId, status: current.status },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        activeAiRunId: null,
        activeAiRunStartedAt: null,
      },
    });
    if (updated.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: CONVERSATION_CLOSED_CONTENT,
        metadata: { kind: 'CONVERSATION_CLOSED', adminId },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: conversationPublicSelect,
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

export async function closeCustomerConversation(userId: number, conversationId: number) {
  const current = await getOwnedConversation(userId, conversationId);
  if (current.status === 'CLOSED') {
    const message = await prisma.chatMessage.findFirst({
      where: { conversationId, senderType: 'SYSTEM', content: CONVERSATION_CLOSED_CONTENT },
      orderBy: { id: 'desc' },
    });
    if (!message) throw AppError.conflict('CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.');
    return { conversation: toPublicConversation(current), message };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.updateMany({
      where: { id: conversationId, userId, status: current.status },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        activeAiRunId: null,
        activeAiRunStartedAt: null,
      },
    });
    if (updated.count === 0) return null;
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        content: CONVERSATION_CLOSED_CONTENT,
        metadata: { kind: 'CONVERSATION_CLOSED', userId, closedBy: 'CUSTOMER' },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: conversationPublicSelect,
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
