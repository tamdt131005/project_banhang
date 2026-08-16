import { Prisma } from '@prisma/client';

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
