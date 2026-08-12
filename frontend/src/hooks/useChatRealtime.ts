import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { ChatConversation, ChatMessage } from '../api/chat';
import { refreshSession } from '../api/client';

export type ChatConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

export type ChatRealtimeEvent =
  | { name: 'conversation.created'; conversation: ChatConversation }
  | { name: 'message.created'; message: ChatMessage }
  | { name: 'support.requested'; conversation: ChatConversation; message: ChatMessage }
  | { name: 'support.accepted'; conversation: ChatConversation; message: ChatMessage }
  | { name: 'conversation.closed'; conversation: ChatConversation; message: ChatMessage };

interface SocketAck {
  ok: boolean;
  error?: { code: string; message: string };
}

export interface UseChatRealtimeOptions {
  enabled: boolean;
  conversationId?: number | null;
  subscribeAdmin?: boolean;
  onEvent: (event: ChatRealtimeEvent) => void;
  /** Chỉ chạy sau khi socket đã mất kết nối rồi rejoin/resubscribe thành công. */
  onReconnect?: () => void;
}

/**
 * Kênh realtime chỉ nhận sự kiện đã commit. Tất cả lệnh ghi vẫn đi qua REST gateway.
 * Cookie httpOnly được trình duyệt gửi cùng handshake; hook không đọc hay lưu JWT.
 */
export function useChatRealtime({
  enabled,
  conversationId,
  subscribeAdmin = false,
  onEvent,
  onReconnect,
}: Readonly<UseChatRealtimeOptions>): ChatConnectionStatus {
  const [status, setStatus] = useState<ChatConnectionStatus>('idle');
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    setStatus('connecting');
    const socket = io({ path: '/socket.io', withCredentials: true, autoConnect: false });
    let hasCompletedInitialSubscription = false;
    let refreshAttempted = false;
    let disposed = false;

    const subscribe = () => {
      setStatus('connected');
      let pendingAcks = Number(conversationId !== undefined && conversationId !== null) + Number(subscribeAdmin);
      let subscriptionFailed = false;

      const completeSubscription = () => {
        if (pendingAcks > 0 || subscriptionFailed) return;
        if (hasCompletedInitialSubscription) onReconnectRef.current?.();
        else hasCompletedInitialSubscription = true;
      };

      const handleAck = (ack: SocketAck) => {
        pendingAcks -= 1;
        if (!ack.ok) {
          subscriptionFailed = true;
          setStatus('disconnected');
        }
        completeSubscription();
      };
      if (conversationId !== undefined && conversationId !== null) {
        socket.emit('conversation:join', { conversationId }, handleAck);
      }
      if (subscribeAdmin) {
        socket.emit('support:subscribe', handleAck);
      }
      completeSubscription();
    };

    socket.on('connect', () => {
      socket.io.reconnection(true);
      refreshAttempted = false;
      subscribe();
    });
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', (error: Error) => {
      setStatus('disconnected');
      if (error.message !== 'UNAUTHORIZED' || refreshAttempted) return;

      refreshAttempted = true;
      socket.io.reconnection(false);
      void refreshSession().then((refreshed) => {
        if (refreshed && !disposed) socket.connect();
      });
    });
    socket.on('conversation.created', ({ conversation }: { conversation: ChatConversation }) =>
      onEventRef.current({ name: 'conversation.created', conversation }),
    );
    socket.on('message.created', ({ message }: { message: ChatMessage }) =>
      onEventRef.current({ name: 'message.created', message }),
    );
    socket.on(
      'support.requested',
      ({ conversation, message }: { conversation: ChatConversation; message: ChatMessage }) =>
        onEventRef.current({ name: 'support.requested', conversation, message }),
    );
    socket.on(
      'support.accepted',
      ({ conversation, message }: { conversation: ChatConversation; message: ChatMessage }) =>
        onEventRef.current({ name: 'support.accepted', conversation, message }),
    );
    socket.on(
      'conversation.closed',
      ({ conversation, message }: { conversation: ChatConversation; message: ChatMessage }) =>
        onEventRef.current({ name: 'conversation.closed', conversation, message }),
    );
    socket.connect();

    return () => {
      disposed = true;
      socket.disconnect();
    };
  }, [conversationId, enabled, subscribeAdmin]);

  return status;
}
