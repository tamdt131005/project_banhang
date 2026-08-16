import { api } from './client';
import type { components, paths } from './generated/admin-contract';

export type ConversationStatus = components['schemas']['ConversationStatus'];
export type MessageSender = components['schemas']['MessageSender'];
type ContractParticipant = components['schemas']['ConversationParticipant'];
type ContractConversation = components['schemas']['Conversation'];
type ContractChatMessage = components['schemas']['ChatMessage'];

export interface ChatParticipant extends ContractParticipant {
  avatarUrl?: string | null;
}

export interface ChatConversation extends ContractConversation {
  user?: ChatParticipant;
  assignedAdmin?: ChatParticipant | null;
}

export interface ChatMessage extends ContractChatMessage {
  sender?: ChatParticipant | null;
}

type JsonResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
  Status extends number,
> = paths[Path][Method] extends { responses: infer Responses }
  ? Status extends keyof Responses
    ? Responses[Status] extends { content: { 'application/json': infer Body } }
      ? Body
      : never
    : never
  : never;

type ContractConversationResponse = JsonResponse<'/chat/conversations', 'post', 201>;
type ContractConversationMessageResponse = JsonResponse<'/chat/conversations/{id}/messages', 'post', 201>;
type ContractMessagePageResponse = JsonResponse<'/chat/conversations/{id}/messages', 'get', 200>;
type ContractCustomerConversationsResponse = JsonResponse<'/chat/conversations', 'get', 200>;

export type CustomerConversationItem = components['schemas']['CustomerConversationItem'];

export interface CustomerConversationsResponse extends Omit<ContractCustomerConversationsResponse, 'items'> {
  items: CustomerConversationItem[];
}

export interface ConversationResponse extends Omit<ContractConversationResponse, 'conversation'> {
  conversation: ChatConversation;
}

export interface ConversationMessageResponse
  extends Omit<ContractConversationMessageResponse, 'conversation' | 'message'> {
  conversation: ChatConversation;
  message: ChatMessage;
  aiPending?: boolean;
}

export interface MessagePageResponse extends Omit<ContractMessagePageResponse, 'messages'> {
  messages: ChatMessage[];
}

export const chatGateway = {
  list: (params?: { page?: number; limit?: number; status?: ConversationStatus }) =>
    api.get<CustomerConversationsResponse>('/api/chat/conversations', params),

  create: () => api.post<ConversationResponse>('/api/chat/conversations'),

  messages: (conversationId: number, page = 1, limit = 100) =>
    api.get<MessagePageResponse>(`/api/chat/conversations/${conversationId}/messages`, {
      page,
      limit,
    }),

  send: (conversationId: number, content: string) =>
    api.post<ConversationMessageResponse>(`/api/chat/conversations/${conversationId}/messages`, {
      content,
    }),

  requestAdmin: (conversationId: number) =>
    api.post<ConversationMessageResponse>(`/api/chat/conversations/${conversationId}/request-admin`),

  close: (conversationId: number) =>
    api.post<ConversationMessageResponse>(`/api/chat/conversations/${conversationId}/close`),
};
