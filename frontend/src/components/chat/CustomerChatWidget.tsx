import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  type ChatConversation,
  type ChatMessage,
  type ConversationStatus,
  chatGateway,
} from '../../api/chat';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { type ChatRealtimeEvent, useChatRealtime } from '../../hooks/useChatRealtime';
import { errorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';
import { Alert, Skeleton } from '../ui/Feedback';
import { SparkleIcon, UsersIcon, XIcon } from '../ui/icons';

export interface CustomerChatWidgetProps {}
type MessagePage = number | 'latest';

interface StoredConversation {
  id: number;
  conversation: ChatConversation;
}

const STATUS_COPY: Record<ConversationStatus, { label: string; detail: string }> = {
  AI: {
    label: 'Tự phục vụ',
    detail: 'Trợ lý AI chưa bật. Bạn vẫn có thể gửi lời nhắn và yêu cầu nhân viên.',
  },
  WAITING_ADMIN: {
    label: 'Đang chờ nhân viên',
    detail: 'Yêu cầu đã được gửi. Nhân viên sẽ tham gia khi sẵn sàng.',
  },
  LIVE: {
    label: 'Đang hỗ trợ',
    detail: 'Bạn đang trao đổi với nhân viên hỗ trợ.',
  },
  CLOSED: {
    label: 'Đã kết thúc',
    detail: 'Cuộc trò chuyện này đã đóng. Bạn có thể bắt đầu cuộc mới.',
  },
};

function storageKey(userId: number): string {
  return `chat:current-conversation:${userId}`;
}

function loadStoredConversation(userId: number): StoredConversation | null {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredConversation>;
    if (typeof value.id !== 'number' || !value.conversation) return null;
    return value as StoredConversation;
  } catch {
    return null;
  }
}

function messageTone(message: ChatMessage): string {
  if (message.senderType === 'USER') return 'ml-auto bg-accent text-accent-ink';
  if (message.senderType === 'SYSTEM') return 'mx-auto bg-sunken text-ink-muted';
  return 'mr-auto border border-line bg-surface text-ink';
}

function senderLabel(message: ChatMessage): string {
  if (message.senderType === 'USER') return 'Bạn';
  if (message.senderType === 'ADMIN') return message.sender?.fullName ?? 'Nhân viên hỗ trợ';
  if (message.senderType === 'AI') return 'Trợ lý';
  return 'Hệ thống';
}

async function loadMessages(conversationId: number, requestedPage: MessagePage) {
  if (requestedPage !== 'latest') {
    return chatGateway.messages(conversationId, requestedPage, 100);
  }

  const firstPage = await chatGateway.messages(conversationId, 1, 100);
  if (firstPage.pagination.totalPages <= 1) return firstPage;
  return chatGateway.messages(conversationId, firstPage.pagination.totalPages, 100);
}

function statusFromMessages(
  current: ChatConversation,
  messages: ChatMessage[],
): ChatConversation {
  if (current.status === 'CLOSED') return current;

  let status: ConversationStatus = current.status;
  let assignedAdminId = current.assignedAdminId;

  for (const message of messages) {
    const kind = message.metadata?.kind;
    if (kind === 'SUPPORT_REQUESTED' && status === 'AI') status = 'WAITING_ADMIN';
    if (kind === 'SUPPORT_ACCEPTED' || message.senderType === 'ADMIN') {
      status = 'LIVE';
      if (typeof message.metadata?.adminId === 'number') {
        assignedAdminId = message.metadata.adminId;
      }
    }
    if (kind === 'CONVERSATION_CLOSED') status = 'CLOSED';
  }

  if (status === current.status && assignedAdminId === current.assignedAdminId) return current;
  return { ...current, status, assignedAdminId };
}

export function CustomerChatWidget({}: Readonly<CustomerChatWidgetProps>) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [content, setContent] = useState('');
  const [messagePage, setMessagePage] = useState<MessagePage>('latest');
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConversation(user ? loadStoredConversation(user.id)?.conversation ?? null : null);
  }, [user]);

  useEffect(() => setMessagePage('latest'), [conversation?.id]);

  function remember(next: ChatConversation | null) {
    setConversation(next);
    if (!user) return;
    if (next) {
      sessionStorage.setItem(storageKey(user.id), JSON.stringify({ id: next.id, conversation: next }));
    } else {
      sessionStorage.removeItem(storageKey(user.id));
    }
  }

  const messages = useQuery({
    queryKey: ['chat', 'conversation', conversation?.id, 'messages', messagePage],
    queryFn: () => loadMessages(conversation!.id, messagePage),
    enabled: Boolean(user && conversation),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (messages.error instanceof ApiError && messages.error.status === 404) {
      remember(null);
    }
  }, [messages.error]);

  useEffect(() => {
    if (!conversation || !messages.data) return;
    const synchronized = statusFromMessages(conversation, messages.data.messages);
    if (synchronized !== conversation) remember(synchronized);
  }, [messages.data]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.data?.messages.length, isOpen]);

  const refreshConversation = useCallback(
    (conversationId: number) => {
      void queryClient.invalidateQueries({
        queryKey: ['chat', 'conversation', conversationId, 'messages'],
      });
    },
    [queryClient],
  );

  const onRealtimeEvent = useCallback(
    (event: ChatRealtimeEvent) => {
      if (event.name === 'message.created') {
        if (event.message.conversationId === conversation?.id) setMessagePage('latest');
        refreshConversation(event.message.conversationId);
        return;
      }
      if (event.name !== 'conversation.created') {
        if (event.conversation.id === conversation?.id) setMessagePage('latest');
        remember(event.conversation);
        refreshConversation(event.conversation.id);
      }
    },
    [conversation?.id, refreshConversation, user],
  );

  const handleReconnect = useCallback(() => {
    if (!conversation) return;
    setMessagePage('latest');
    refreshConversation(conversation.id);
  }, [conversation, refreshConversation]);

  const connectionStatus = useChatRealtime({
    enabled: Boolean(isOpen && user && conversation),
    conversationId: conversation?.id,
    onEvent: onRealtimeEvent,
    onReconnect: handleReconnect,
  });

  const createConversation = useMutation({
    mutationFn: chatGateway.create,
    onSuccess: ({ conversation: next }) => {
      remember(next);
      setMessagePage('latest');
      queryClient.setQueryData(['chat', 'conversation', next.id, 'messages', 'latest'], {
        messages: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      });
    },
  });

  const sendMessage = useMutation({
    mutationFn: (text: string) => chatGateway.send(conversation!.id, text),
    onSuccess: ({ conversation: next }) => {
      remember(next);
      setContent('');
      setMessagePage('latest');
      refreshConversation(next.id);
    },
  });

  const requestAdmin = useMutation({
    mutationFn: () => chatGateway.requestAdmin(conversation!.id),
    onSuccess: ({ conversation: next }) => {
      remember(next);
      setMessagePage('latest');
      refreshConversation(next.id);
    },
  });

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const text = content.trim();
    if (!text || !conversation || conversation.status === 'CLOSED') return;
    sendMessage.mutate(text);
  }

  function goToLogin() {
    navigate('/dang-nhap', { state: { from: location.pathname } });
  }

  const actionError = createConversation.error ?? sendMessage.error ?? requestAdmin.error;
  const statusCopy = conversation ? STATUS_COPY[conversation.status] : null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {isOpen ? (
        <section
          aria-label="Hỗ trợ khách hàng"
          className="flex h-[min(38rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-2xl"
        >
          <header className="flex items-center gap-3 border-b border-line bg-ink px-4 py-3 text-canvas dark:bg-sunken dark:text-ink">
            <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-ink">
              <UsersIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Hỗ trợ CHUẨN.</h2>
              <p className="text-xs opacity-70">
                {connectionStatus === 'disconnected' ? 'Đang kết nối lại…' : statusCopy?.label ?? 'Sẵn sàng hỗ trợ'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng hỗ trợ"
              className="grid size-9 place-items-center rounded-control hover:bg-white/10"
            >
              <XIcon className="size-4" />
            </button>
          </header>

          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-32" />
            </div>
          ) : !user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <SparkleIcon className="size-9 text-accent" />
              <div>
                <p className="font-semibold">Đăng nhập để bắt đầu</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Cuộc trò chuyện được bảo vệ và gắn với tài khoản của bạn.
                </p>
              </div>
              <Button onClick={goToLogin}>Đăng nhập</Button>
            </div>
          ) : !conversation ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <UsersIcon className="size-9 text-accent" />
              <div>
                <p className="font-semibold">Bạn cần CHUẨN. hỗ trợ gì?</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Gửi câu hỏi bất kỳ, hoặc yêu cầu nhân viên tham gia cuộc trò chuyện.
                </p>
              </div>
              <Button
                onClick={() => createConversation.mutate()}
                loading={createConversation.isPending}
              >
                Bắt đầu trò chuyện
              </Button>
              {createConversation.isError ? <Alert>{errorMessage(createConversation.error)}</Alert> : null}
            </div>
          ) : (
            <>
              <div className="border-b border-line bg-sunken px-4 py-2.5 text-xs text-ink-muted">
                <p className="font-medium text-ink">{statusCopy?.label}</p>
                <p>{statusCopy?.detail}</p>
              </div>

              {messages.data && messages.data.pagination.totalPages > 1 ? (
                <nav
                  aria-label="Phân trang tin nhắn"
                  className="flex items-center justify-center gap-2 border-b border-line px-3 py-2 text-xs"
                >
                  <button
                    type="button"
                    disabled={messages.data.pagination.page <= 1}
                    onClick={() => setMessagePage(messages.data.pagination.page - 1)}
                    className="rounded-control border border-line px-2 py-1.5 font-medium hover:bg-sunken disabled:opacity-40"
                  >
                    Tin cũ hơn
                  </button>
                  <span className="text-ink-muted">
                    {messages.data.pagination.page}/{messages.data.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={messages.data.pagination.page >= messages.data.pagination.totalPages}
                    onClick={() => setMessagePage(messages.data.pagination.page + 1)}
                    className="rounded-control border border-line px-2 py-1.5 font-medium hover:bg-sunken disabled:opacity-40"
                  >
                    Tin mới hơn
                  </button>
                </nav>
              ) : null}

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
                {messages.isPending ? (
                  <>
                    <Skeleton className="h-14 w-3/4" />
                    <Skeleton className="ml-auto h-14 w-2/3" />
                  </>
                ) : messages.isError ? (
                  <Alert>{errorMessage(messages.error)}</Alert>
                ) : messages.data.messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">
                    Hãy gửi tin nhắn đầu tiên của bạn.
                  </p>
                ) : (
                  messages.data.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`max-w-[85%] rounded-control px-3 py-2 text-sm ${messageTone(message)}`}
                    >
                      <p className="mb-0.5 text-[0.6875rem] font-semibold opacity-70">
                        {senderLabel(message)}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </article>
                  ))
                )}
                <div ref={messageEndRef} />
              </div>

              <div className="space-y-2 border-t border-line p-3">
                {actionError ? <Alert>{errorMessage(actionError)}</Alert> : null}

                {conversation.status === 'AI' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => requestAdmin.mutate()}
                    loading={requestAdmin.isPending}
                  >
                    <UsersIcon className="size-4" />
                    Yêu cầu nhân viên
                  </Button>
                ) : null}

                {conversation.status === 'CLOSED' ? (
                  <Button variant="secondary" className="w-full" onClick={() => remember(null)}>
                    Bắt đầu cuộc mới
                  </Button>
                ) : (
                  <form onSubmit={submitMessage} className="flex gap-2">
                    <label htmlFor="customer-chat-message" className="sr-only">
                      Nội dung tin nhắn
                    </label>
                    <textarea
                      id="customer-chat-message"
                      rows={2}
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder="Nhập tin nhắn…"
                      className="min-h-11 flex-1 resize-none rounded-control border border-line bg-sunken px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!content.trim()}
                      loading={sendMessage.isPending}
                    >
                      Gửi
                    </Button>
                  </form>
                )}
              </div>
            </>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Đóng hỗ trợ' : 'Mở hỗ trợ'}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-4 font-semibold text-accent-ink shadow-lg transition-transform duration-[160ms] ease-snap hover:-translate-y-0.5"
      >
        <UsersIcon className="size-5" />
        <span>Hỗ trợ</span>
      </button>
    </div>
  );
}
