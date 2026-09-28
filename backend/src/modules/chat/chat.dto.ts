import { Prisma } from '@prisma/client';
import { STAFF_NOTE_PREFIX } from './chat.constants.js';

/** Ghi chú nội bộ không được xuất hiện trong lịch sử khách hàng nhìn thấy. */
export const customerVisibleMessageWhere = {
  NOT: {
    AND: [{ senderType: 'SYSTEM' }, { content: { startsWith: STAFF_NOTE_PREFIX } }],
  },
} satisfies Prisma.ChatMessageWhereInput;

export const conversationPublicSelect = {
  id: true,
  userId: true,
  assignedAdminId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
} satisfies Prisma.ConversationSelect;

export const conversationInternalSelect = {
  ...conversationPublicSelect,
  activeAiRunId: true,
  activeAiRunStartedAt: true,
} satisfies Prisma.ConversationSelect;

export type PublicConversation = Prisma.ConversationGetPayload<{
  select: typeof conversationPublicSelect;
}>;

export const customerConversationItemSelect = {
  ...conversationPublicSelect,
  assignedAdmin: { select: { id: true, email: true, fullName: true } },
  messages: {
    where: customerVisibleMessageWhere,
    take: 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      senderType: true,
      content: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ConversationSelect;

export const adminConversationSelect = {
  ...conversationPublicSelect,
  user: { select: { id: true, email: true, fullName: true } },
  assignedAdmin: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.ConversationSelect;
