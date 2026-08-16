import { EventEmitter } from 'node:events';
import type { ChatMessage } from '@prisma/client';
import type { PublicConversation } from './chat.dto.js';

export interface ChatCommittedEvents {
  'conversation.created': { conversation: PublicConversation };
  'message.created': { message: ChatMessage };
  'support.requested': { conversation: PublicConversation; message: ChatMessage };
  'support.accepted': { conversation: PublicConversation; message: ChatMessage };
  'conversation.closed': { conversation: PublicConversation; message: ChatMessage };
}

class ChatEventBus extends EventEmitter {
  publish<K extends keyof ChatCommittedEvents>(event: K, payload: ChatCommittedEvents[K]) {
    this.emit(event, payload);
  }

  subscribe<K extends keyof ChatCommittedEvents>(
    event: K,
    listener: (payload: ChatCommittedEvents[K]) => void,
  ) {
    this.on(event, listener);
    return () => this.off(event, listener);
  }
}

/** In-process delivery seam. Services publish only after their database write commits. */
export const chatEvents = new ChatEventBus();
