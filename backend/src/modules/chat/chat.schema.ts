import { z } from 'zod';

export const conversationParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const chatMessageSchema = z.object({
  content: z.string().trim().min(1, 'Tin nhắn không được để trống').max(4_000),
});

export const messageListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export const customerConversationListQuerySchema = messageListQuerySchema.extend({
  status: z.enum(['AI', 'WAITING_ADMIN', 'LIVE', 'CLOSED']).optional(),
});

export const adminConversationListQuerySchema = messageListQuerySchema.extend({
  status: z.enum(['AI', 'WAITING_ADMIN', 'LIVE', 'CLOSED']).optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type MessageListQuery = z.infer<typeof messageListQuerySchema>;
export type CustomerConversationListQuery = z.infer<typeof customerConversationListQuerySchema>;
export type AdminConversationListQuery = z.infer<typeof adminConversationListQuerySchema>;
