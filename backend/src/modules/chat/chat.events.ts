import { EventEmitter } from 'node:events';
import type { ChatMessage, Conversation } from '@prisma/client';

export interface ChatCommittedEvents {
  'conversation.created': { conversation: Conversation };
  'message.created': { message: ChatMessage };
  'support.requested': { conversation: Conversation; message: ChatMessage };
  'support.accepted': { conversation: Conversation; message: ChatMessage };
  'conversation.closed': { conversation: Conversation; message: ChatMessage };
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
