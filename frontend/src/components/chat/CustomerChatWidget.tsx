import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  type ChatConversation,
  type ChatMessage,
  type ConversationStatus,
  type CustomerConversationItem,
  chatGateway,
} from '../../api/chat';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { type ChatRealtimeEvent, useChatRealtime } from '../../hooks/useChatRealtime';
import { errorMessage } from '../../lib/errors';
import { formatDateTime, formatVnd } from '../../lib/format';
import { Button } from '../ui/Button';
import { Alert, Skeleton } from '../ui/Feedback';
import {
  ArrowLeftIcon,
  BagIcon,
  ChevronRightIcon,
  PlusIcon,
  ReceiptIcon,
  RefreshIcon,
  SendIcon,
  SparkleIcon,
  UsersIcon,
  XIcon,
} from '../ui/icons';

export interface CustomerChatWidgetProps {}
type MessagePage = number | 'latest';

interface StoredConversation {
  id: number;
  conversation: ChatConversation;
}

const STATUS_COPY: Record<ConversationStatus, { label: string; detail: string; badge: string }> = {
  AI: {
    label: 'Trợ lý AI sẵn sàng',
    detail: 'Hỗ trợ tư vấn sản phẩm, size và chuyển nhân viên khi bạn cần.',
    badge: 'Tự động 24/7',
  },
  WAITING_ADMIN: {
    label: 'Đang kết nối nhân viên',
    detail: 'Yêu cầu của bạn đã được chuyển tới đội ngũ hỗ trợ.',
    badge: 'Chờ nhân viên',
  },
  LIVE: {
    label: 'Đang chat với nhân viên',
    detail: 'Nhân viên hỗ trợ Tâm Đặng đang trực tiếp phản hồi bạn.',
    badge: 'Trực tiếp',
  },
  CLOSED: {
    label: 'Cuộc trò chuyện đã kết thúc',
    detail: 'Bạn có thể bắt đầu cuộc trò chuyện mới bất cứ lúc nào.',
    badge: 'Đã đóng',
  },
};

const DEFAULT_QUICK_QUESTIONS = [
  'Tư vấn chọn size áo & quần',
  'Chính sách đổi trả trong bao lâu?',
  'Phí vận chuyển và thời gian giao hàng?',
  'Tôi muốn gặp nhân viên hỗ trợ',
];

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

interface ChatMatchingVariant {
  id: number;
  size: string;
  color: string;
  available: boolean;
}

interface ChatProductCard {
  id: number;
  name: string;
  slug: string;
  price: number;
  stock: number;
  category: { name: string };
  image: { thumbUrl: string } | null;
  matchingVariants: ChatMatchingVariant[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function chatMatchingVariants(value: unknown): ChatMatchingVariant[] {
  if (!Array.isArray(value)) return [];
  return value.filter((variant): variant is ChatMatchingVariant => {
    if (!isRecord(variant)) return false;
    return (
      typeof variant.id === 'number' &&
      typeof variant.size === 'string' &&
      typeof variant.color === 'string' &&
      typeof variant.available === 'boolean'
    );
  });
}

function chatProductImage(value: unknown): { thumbUrl: string } | null {
  if (value === null) return null;
  if (isRecord(value) && typeof value.thumbUrl === 'string') return { thumbUrl: value.thumbUrl };
  return null;
}

function chatProducts(message: ChatMessage): ChatProductCard[] {
  if (message.senderType !== 'AI' || !isRecord(message.metadata)) return [];
  const products = message.metadata.products;
  if (!Array.isArray(products)) return [];
  return products.flatMap((product): ChatProductCard[] => {
    if (!isRecord(product) || !isRecord(product.category)) return [];
    if (
      typeof product.id === 'number' &&
      typeof product.name === 'string' &&
      typeof product.slug === 'string' &&
      typeof product.price === 'number' &&
      typeof product.stock === 'number' &&
      typeof product.category.name === 'string' &&
      (product.image === null || chatProductImage(product.image) !== null)
    ) {
      return [
        {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          stock: product.stock,
          category: { name: product.category.name },
          image: chatProductImage(product.image),
          matchingVariants: chatMatchingVariants(product.matchingVariants),
        },
      ];
    }
    return [];
  });
}

function chatSuggestions(message: ChatMessage): string[] {
  if (message.senderType !== 'AI' || !isRecord(message.metadata)) return [];
  const suggestions = message.metadata.suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.filter((item): item is string => typeof item === 'string').slice(0, 3);
}

/**
 * Xử lý làm sạch nội dung tin nhắn, phòng vệ tuyệt đối việc chuỗi JSON bị nhả ra giao diện.
 */
function cleanDisplayContent(raw: string): { content: string; extractedSuggestions?: string[] } {
  const trimmed = raw.trim();

  // Kiểm tra chuỗi JSON dạng object hoặc markdown code block chứa JSON
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    trimmed.startsWith('```json') ||
    trimmed.startsWith('```') ||
    trimmed.includes('"message":')
  ) {
    try {
      const clean = trimmed
        .replace(/^```(?:json)?[\t ]*\r?\n?/i, '')
        .replace(/\r?\n?```[\t ]*$/i, '')
        .trim();
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      const jsonCandidate =
        firstBrace !== -1 && lastBrace > firstBrace ? clean.slice(firstBrace, lastBrace + 1) : clean;
      const obj = JSON.parse(jsonCandidate) as Record<string, unknown>;

      if (typeof obj === 'object' && obj !== null) {
        const textVal =
          obj['message'] ?? obj['text'] ?? obj['content'] ?? obj['response'] ?? obj['reply'];
        if (typeof textVal === 'string' && textVal.trim()) {
          const suggestions = Array.isArray(obj['suggestions'])
            ? obj['suggestions'].filter((item): item is string => typeof item === 'string')
            : undefined;
          return { content: textVal.trim(), extractedSuggestions: suggestions };
        }
      }
    } catch {
      // Tìm theo regex nếu JSON lỗi cú pháp nhẹ
      const match = trimmed.match(
        /"(?:message|text|content|response|reply)":\s*"((?:[^"\\]|\\.)*)"/i,
      );
      if (match?.[1]) {
        try {
          const unescaped = JSON.parse(`"${match[1]}"`) as string;
          if (unescaped.trim()) return { content: unescaped.trim() };
        } catch {
          // ignore
        }
      }
    }
  }

  // Loại bỏ các khối code block thừa nếu có
  const cleaned = trimmed
    .replace(/```(?:json)?\s*[\s\S]*?```/gi, (match) => {
      return match.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    })
    .replace(/^```(?:json)?/gi, '')
    .replace(/```$/g, '')
    .trim();

  return { content: cleaned || raw };
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

function ChatMessageBubble({
  message,
  onSuggestion,
}: Readonly<{ message: ChatMessage; onSuggestion: (value: string) => void }>) {
  const products = chatProducts(message);
  const rawSuggestions = chatSuggestions(message);
  const { content, extractedSuggestions } = cleanDisplayContent(message.content);
  const suggestions = rawSuggestions.length > 0 ? rawSuggestions : (extractedSuggestions ?? []);

  if (message.senderType === 'SYSTEM') {
    return (
      <div className="flex justify-center my-2">
        <span className="rounded-full bg-sunken px-3 py-1 text-center text-xs text-ink-muted border border-line">
          {content}
        </span>
      </div>
    );
  }

  const isUser = message.senderType === 'USER';
  const isAdmin = message.senderType === 'ADMIN';

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold ${
            isAdmin ? 'bg-sky-600 text-white' : 'bg-accent/15 text-accent'
          }`}
          title={isAdmin ? 'Nhân viên hỗ trợ' : 'Trợ lý AI'}
        >
          {isAdmin ? <UsersIcon className="size-3.5" /> : <SparkleIcon className="size-3.5" />}
        </span>
      ) : null}

      <div className={`max-w-[85%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser ? (
          <p className="px-1 text-[0.6875rem] font-semibold text-ink-muted">
            {isAdmin ? message.sender?.fullName ?? 'Nhân viên hỗ trợ' : 'Trợ lý Tâm Đặng'}
          </p>
        ) : null}

        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-xs ${
            isUser
              ? 'rounded-br-xs bg-accent text-accent-ink'
              : 'rounded-bl-xs border border-line bg-surface text-ink'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>

          {products.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-muted">
                Sản phẩm gợi ý ({products.length})
              </p>
              {products.map((product) => (
                <ProductRecommendationCard key={product.id} product={product} />
              ))}
            </div>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="mt-3 space-y-1.5 border-t border-line/60 pt-2">
              <p className="text-[0.6875rem] text-ink-muted">Gợi ý câu hỏi:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onSuggestion(suggestion)}
                    className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft/50 px-2.5 py-1 text-xs font-medium text-accent transition hover:border-accent hover:bg-accent hover:text-accent-ink"
                  >
                    <span>{suggestion}</span>
                    <ChevronRightIcon className="size-2.5" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProductRecommendationCard({ product }: Readonly<{ product: ChatProductCard }>) {
  const variantSummary = product.matchingVariants
    .slice(0, 2)
    .map((variant) => `${variant.color} / ${variant.size}${variant.available ? '' : ' (hết)'}`)
    .join(', ');

  return (
    <Link
      to={`/san-pham/${product.slug}`}
      className="group flex gap-2.5 rounded-control border border-line bg-surface p-2 text-ink transition-all hover:border-accent hover:shadow-sm"
    >
      <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-control bg-sunken">
        {product.image ? (
          <img
            src={product.image.thumbUrl}
            alt={product.name}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <BagIcon className="size-5 text-ink-muted" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <p className="line-clamp-1 text-xs font-semibold group-hover:text-accent">{product.name}</p>
        <p className="tabular mt-0.5 text-xs font-bold text-accent">{formatVnd(product.price)}</p>
        {variantSummary ? (
          <p className="mt-0.5 text-[0.6875rem] text-ink-muted truncate">
            Phù hợp: <span className="font-medium text-ink">{variantSummary}</span>
          </p>
        ) : null}
        <div className="mt-1 flex items-center justify-between text-[0.625rem]">
          <span className="text-ink-muted">{product.category.name}</span>
          <span
            className={`font-medium ${product.stock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}
          >
            {product.stock > 0 ? `Còn hàng (${product.stock})` : 'Hết hàng'}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CustomerChatWidget({}: Readonly<CustomerChatWidgetProps>) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [content, setContent] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [messagePage, setMessagePage] = useState<MessagePage>('latest');
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const historyQuery = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => chatGateway.list({ limit: 50 }),
    enabled: Boolean(user && (isOpen || showHistory)),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setConversation(user ? loadStoredConversation(user.id)?.conversation ?? null : null);
  }, [user]);

  useEffect(() => setMessagePage('latest'), [conversation?.id]);
  useEffect(() => setAiPending(false), [conversation?.id, conversation?.status]);

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
    const last = messages.data.messages.at(-1);
    if (last?.senderType === 'AI' || synchronized.status !== 'AI') setAiPending(false);
  }, [messages.data]);

  useEffect(() => {
    if (isOpen) {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      inputRef.current?.focus();
    }
  }, [messages.data?.messages.length, isOpen, aiPending]);

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
        if (event.message.conversationId === conversation?.id && event.message.senderType === 'AI') {
          setAiPending(false);
        }
        refreshConversation(event.message.conversationId);
        return;
      }
      if (event.name !== 'conversation.created') {
        if (event.conversation.id === conversation?.id) setMessagePage('latest');
        if (event.conversation.id === conversation?.id && event.conversation.status !== 'AI') {
          setAiPending(false);
        }
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
      setAiPending(false);
      setMessagePage('latest');
      queryClient.setQueryData(['chat', 'conversation', next.id, 'messages', 'latest'], {
        messages: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      });
    },
  });

  const sendMessage = useMutation({
    mutationFn: (text: string) => chatGateway.send(conversation!.id, text),
    onSuccess: ({ conversation: next, aiPending: nextAiPending }) => {
      remember(next);
      setContent('');
      setMessagePage('latest');
      setAiPending(Boolean(nextAiPending));
      refreshConversation(next.id);
    },
  });

  const requestAdmin = useMutation({
    mutationFn: () => chatGateway.requestAdmin(conversation!.id),
    onSuccess: ({ conversation: next }) => {
      remember(next);
      setAiPending(false);
      setMessagePage('latest');
      refreshConversation(next.id);
    },
  });

  const closeConversationMutation = useMutation({
    mutationFn: () => chatGateway.close(conversation!.id),
    onSuccess: () => {
      // Sau khi đóng cuộc trò chuyện hiện tại, tạo ngay cuộc trò chuyện mới để tiếp tục với AI
      createConversation.mutate(undefined, {
        onSuccess: ({ conversation: next }) => {
          remember(next);
          setAiPending(false);
          setMessagePage('latest');
          queryClient.setQueryData(['chat', 'conversation', next.id, 'messages', 'latest'], {
            messages: [],
            pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
          });
        },
      });
    },
  });

  function sendCurrentMessage(customText?: string) {
    const text = (customText ?? content).trim();
    if (!text || !conversation || conversation.status === 'CLOSED' || aiPending) return;
    sendMessage.mutate(text);
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    sendCurrentMessage();
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    sendCurrentMessage();
  }

  function handleQuickQuestion(text: string) {
    if (!conversation) {
      createConversation.mutate(undefined, {
        onSuccess: ({ conversation: next }) => {
          chatGateway.send(next.id, text).then(({ conversation: updated, aiPending: nextAi }) => {
            remember(updated);
            setAiPending(Boolean(nextAi));
            refreshConversation(updated.id);
          });
        },
      });
    } else {
      sendCurrentMessage(text);
    }
  }

  function goToLogin() {
    navigate('/dang-nhap', { state: { from: location.pathname } });
  }

  const actionError =
    createConversation.error ??
    sendMessage.error ??
    requestAdmin.error ??
    closeConversationMutation.error;
  const statusCopy = conversation ? STATUS_COPY[conversation.status] : null;
  const canSend = Boolean(
    content.trim() &&
      conversation &&
      conversation.status !== 'CLOSED' &&
      !aiPending &&
      !sendMessage.isPending,
  );

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {isOpen ? (
        <section
          aria-label="Hỗ trợ khách hàng Tâm Đặng"
          className="flex h-[min(48rem,calc(100dvh-5rem))] w-[min(26rem,calc(100vw-2rem))] sm:w-[28rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all"
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3.5 text-ink shadow-xs">
            <div className="relative">
              <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-ink shadow-xs">
                <UsersIcon className="size-5" />
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-emerald-500" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm leading-tight text-ink">
                  {showHistory
                    ? 'Lịch sử ticket'
                    : conversation
                      ? `Ticket #${conversation.id}`
                      : 'Hỗ trợ Tâm Đặng'}
                </h2>
                {!showHistory && statusCopy ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.625rem] font-bold text-accent">
                    {statusCopy.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-ink-muted truncate">
                {showHistory
                  ? 'Danh sách các cuộc trò chuyện của bạn'
                  : connectionStatus === 'disconnected'
                    ? 'Đang kết nối lại…'
                    : statusCopy?.label ?? 'Sẵn sàng phản hồi mọi thắc mắc'}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {showHistory ? (
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  title="Quay lại cuộc trò chuyện"
                  aria-label="Quay lại cuộc trò chuyện"
                  className="grid size-8 place-items-center rounded-control text-ink-muted transition hover:bg-sunken hover:text-ink"
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
              ) : (
                <>
                  {user ? (
                    <button
                      type="button"
                      onClick={() => setShowHistory(true)}
                      title="Danh sách ticket / Cuộc trò chuyện"
                      aria-label="Danh sách ticket"
                      className="grid size-8 place-items-center rounded-control text-ink-muted transition hover:bg-sunken hover:text-ink"
                    >
                      <ReceiptIcon className="size-4" />
                    </button>
                  ) : null}
                  {conversation ? (
                    <button
                      type="button"
                      onClick={() => refreshConversation(conversation.id)}
                      title="Làm mới tin nhắn"
                      aria-label="Làm mới tin nhắn"
                      className="grid size-8 place-items-center rounded-control text-ink-muted transition hover:bg-sunken hover:text-ink"
                    >
                      <RefreshIcon className="size-4" />
                    </button>
                  ) : null}
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowHistory(false);
                }}
                aria-label="Đóng khung hỗ trợ"
                className="grid size-8 place-items-center rounded-control text-ink-muted transition hover:bg-sunken hover:text-ink"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          </header>

          {/* Body */}
          {isLoading ? (
            <div className="space-y-3 p-4 flex-1">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ) : !user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
                <SparkleIcon className="size-7" />
              </div>
              <div>
                <p className="font-semibold text-base">Đăng nhập để nhận hỗ trợ</p>
                <p className="mt-1.5 text-xs text-ink-muted leading-relaxed max-w-xs">
                  Trò chuyện trực tiếp với Trợ lý AI và nhân viên tư vấn về đơn hàng, kích cỡ sản phẩm của bạn.
                </p>
              </div>
              <Button onClick={goToLogin} className="mt-2">
                Đăng nhập ngay
              </Button>
            </div>
          ) : showHistory ? (
            /* History / Ticket List View */
            <div className="flex flex-1 flex-col justify-between overflow-hidden p-4">
              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                <div className="flex items-center justify-between pb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Tất cả Ticket ({historyQuery.data?.pagination.total ?? 0})
                  </p>
                  <Button
                    size="sm"
                    onClick={() =>
                      createConversation.mutate(undefined, {
                        onSuccess: () => setShowHistory(false),
                      })
                    }
                    loading={createConversation.isPending}
                    className="inline-flex items-center gap-1 text-xs py-1 px-2.5 h-auto"
                  >
                    <PlusIcon className="size-3" />
                    <span>Ticket mới</span>
                  </Button>
                </div>

                {historyQuery.isPending ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                  </div>
                ) : historyQuery.isError ? (
                  <Alert>{errorMessage(historyQuery.error)}</Alert>
                ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
                  <div className="py-12 text-center text-xs text-ink-muted">
                    <ReceiptIcon className="mx-auto mb-2 size-8 text-ink-muted/50" />
                    <p className="font-semibold text-ink">Chưa có ticket nào</p>
                    <p className="mt-1">Bắt đầu trò chuyện để tạo ticket hỗ trợ đầu tiên.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyQuery.data?.items.map((item) => {
                      const isSelected = conversation?.id === item.id;
                      const copy = STATUS_COPY[item.status];
                      const lastMessage = item.messages[0];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            remember(item);
                            setShowHistory(false);
                          }}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? 'border-accent bg-accent-soft/40 shadow-xs'
                              : 'border-line bg-surface hover:border-accent hover:bg-sunken'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-ink">Ticket #{item.id}</span>
                            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.625rem] font-bold text-accent">
                              {copy.badge}
                            </span>
                          </div>
                          {lastMessage ? (
                            <p className="mt-1.5 line-clamp-1 text-xs text-ink-muted">
                              <span className="font-medium text-ink">
                                {lastMessage.senderType === 'USER'
                                  ? 'Bạn: '
                                  : lastMessage.senderType === 'AI'
                                    ? 'AI: '
                                    : 'Nhân viên: '}
                              </span>
                              {lastMessage.content}
                            </p>
                          ) : (
                            <p className="mt-1.5 text-xs text-ink-muted italic">Chưa có tin nhắn</p>
                          )}
                          <p className="mt-2 text-[0.625rem] text-ink-muted/80">
                            {formatDateTime(item.updatedAt)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : !conversation ? (
            <div className="flex flex-1 flex-col justify-between p-5 overflow-y-auto">
              <div className="text-center pt-4 space-y-3">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
                  <SparkleIcon className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Chào bạn, mình có thể giúp gì?</h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    Hỏi bất kỳ câu hỏi nào về sản phẩm, size hoặc yêu cầu nhân viên hỗ trợ.
                  </p>
                </div>
              </div>

              {/* Quick starter questions */}
              <div className="my-6 space-y-2">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider px-1">
                  Câu hỏi thường gặp
                </p>
                <div className="space-y-1.5">
                  {DEFAULT_QUICK_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => handleQuickQuestion(question)}
                      className="group flex w-full items-center justify-between rounded-xl border border-line bg-surface p-3 text-left text-xs font-medium text-ink transition hover:border-accent hover:bg-accent-soft/30"
                    >
                      <span>{question}</span>
                      <ChevronRightIcon className="size-3.5 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {(historyQuery.data?.items.length ?? 0) > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() => setShowHistory(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5"
                  >
                    <ReceiptIcon className="size-4" />
                    <span>Xem lịch sử ({historyQuery.data?.pagination.total ?? 0} ticket)</span>
                  </Button>
                ) : null}
                <Button
                  onClick={() => createConversation.mutate()}
                  loading={createConversation.isPending}
                  className="w-full"
                >
                  Bắt đầu trò chuyện mới
                </Button>
                {createConversation.error ? (
                  <Alert>{errorMessage(createConversation.error)}</Alert>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {/* Notice Bar */}
              <div className="flex items-center justify-between border-b border-line bg-sunken/80 px-4 py-2 text-xs text-ink-muted">
                <span className="truncate pr-2">{statusCopy?.detail}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    className="font-medium text-ink-muted hover:text-ink hover:underline"
                  >
                    Xem ticket khác
                  </button>
                  {conversation.status === 'AI' ? (
                    <button
                      type="button"
                      onClick={() => requestAdmin.mutate()}
                      disabled={requestAdmin.isPending}
                      className="font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      Gặp nhân viên
                    </button>
                  ) : conversation.status === 'WAITING_ADMIN' || conversation.status === 'LIVE' ? (
                    <button
                      type="button"
                      onClick={() => closeConversationMutation.mutate()}
                      disabled={closeConversationMutation.isPending || createConversation.isPending}
                      className="font-medium text-accent hover:underline disabled:opacity-50"
                      title="Kết thúc hỗ trợ từ nhân viên và tiếp tục trò chuyện với trợ lý AI"
                    >
                      Quay lại với AI
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Pagination if multiple pages */}
              {messages.data && messages.data.pagination.totalPages > 1 ? (
                <nav
                  aria-label="Phân trang tin nhắn"
                  className="flex items-center justify-center gap-2 border-b border-line px-3 py-1.5 text-xs bg-surface"
                >
                  <button
                    type="button"
                    disabled={messages.data.pagination.page <= 1}
                    onClick={() => setMessagePage(messages.data.pagination.page - 1)}
                    className="rounded-control border border-line px-2 py-1 font-medium hover:bg-sunken disabled:opacity-40"
                  >
                    Tin cũ hơn
                  </button>
                  <span className="text-ink-muted text-[0.6875rem]">
                    {messages.data.pagination.page}/{messages.data.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={messages.data.pagination.page >= messages.data.pagination.totalPages}
                    onClick={() => setMessagePage(messages.data.pagination.page + 1)}
                    className="rounded-control border border-line px-2 py-1 font-medium hover:bg-sunken disabled:opacity-40"
                  >
                    Tin mới hơn
                  </button>
                </nav>
              ) : null}

              {/* Messages list */}
              <div className="flex-1 space-y-3.5 overflow-y-auto p-4 bg-canvas/40" aria-live="polite">
                {messages.isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-3/4 rounded-xl" />
                    <Skeleton className="ml-auto h-12 w-2/3 rounded-xl" />
                    <Skeleton className="h-20 w-4/5 rounded-xl" />
                  </div>
                ) : messages.isError ? (
                  <Alert>{errorMessage(messages.error)}</Alert>
                ) : messages.data.messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-ink-muted">
                    <p className="font-semibold text-ink">Chưa có tin nhắn nào</p>
                    <p className="mt-1">Hãy nhập câu hỏi bên dưới để bắt đầu cuộc trò chuyện.</p>
                  </div>
                ) : (
                  messages.data.messages.map((message) => (
                    <ChatMessageBubble
                      key={message.id}
                      message={message}
                      onSuggestion={(value) => sendCurrentMessage(value)}
                    />
                  ))
                )}

                {/* AI Typing Indicator */}
                {aiPending ? (
                  <div className="flex items-end gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent text-[0.6875rem]">
                      <SparkleIcon className="size-3.5" />
                    </span>
                    <div className="rounded-2xl rounded-bl-xs border border-line bg-surface px-4 py-3 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-accent typing-dot-1" />
                        <span className="size-2 rounded-full bg-accent typing-dot-2" />
                        <span className="size-2 rounded-full bg-accent typing-dot-3" />
                        <span className="ml-2 text-xs text-ink-muted">Trợ lý đang trả lời…</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div ref={messageEndRef} />
              </div>

              {/* Footer Input Area */}
              <div className="border-t border-line bg-surface p-3 space-y-2">
                {actionError ? <Alert>{errorMessage(actionError)}</Alert> : null}

                {conversation.status === 'CLOSED' ? (
                  <div className="text-center p-2 space-y-2">
                    <p className="text-xs text-ink-muted">Cuộc trò chuyện này đã kết thúc.</p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setShowHistory(true)}
                      >
                        Lịch sử ticket
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => createConversation.mutate()}
                      >
                        Ticket mới
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitMessage} className="space-y-2">
                    <div className="relative">
                      <textarea
                        ref={inputRef}
                        rows={2}
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        onKeyDown={handleMessageKeyDown}
                        placeholder={
                          aiPending
                            ? 'Trợ lý đang trả lời, vui lòng đợi một chút…'
                            : 'Nhập tin nhắn (Enter để gửi, Shift+Enter xuống dòng)…'
                        }
                        disabled={aiPending}
                        className="w-full resize-none rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:bg-surface disabled:opacity-60"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {conversation.status === 'AI' ? (
                          <button
                            type="button"
                            onClick={() => requestAdmin.mutate()}
                            disabled={requestAdmin.isPending}
                            className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-sunken hover:text-ink disabled:opacity-50"
                            title="Chuyển cuộc trò chuyện cho nhân viên hỗ trợ"
                          >
                            <UsersIcon className="size-3.5" />
                            <span>Gặp nhân viên</span>
                          </button>
                        ) : conversation.status === 'WAITING_ADMIN' || conversation.status === 'LIVE' ? (
                          <button
                            type="button"
                            onClick={() => closeConversationMutation.mutate()}
                            disabled={closeConversationMutation.isPending || createConversation.isPending}
                            className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-50"
                            title="Đóng cuộc trò chuyện này và tiếp tục trò chuyện với trợ lý AI"
                          >
                            <SparkleIcon className="size-3.5" />
                            <span>Chat với AI</span>
                          </button>
                        ) : null}
                      </div>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={!canSend}
                        loading={sendMessage.isPending}
                        className="inline-flex items-center gap-1.5 px-4"
                      >
                        <span>Gửi</span>
                        <SendIcon className="size-3.5" />
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* Floating launcher trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Đóng khung hỗ trợ' : 'Mở khung hỗ trợ khách hàng'}
        className="group relative inline-flex h-12 items-center gap-2.5 rounded-full bg-accent px-4.5 font-semibold text-accent-ink shadow-xl transition-all duration-[160ms] ease-snap hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0"
      >
        <span className="relative">
          <UsersIcon className="size-5" />
          <span className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-accent bg-emerald-400" />
        </span>
        <span className="text-sm">Hỗ trợ 24/7</span>
      </button>
    </div>
  );
}
