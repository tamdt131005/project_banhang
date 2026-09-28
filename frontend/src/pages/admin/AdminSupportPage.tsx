import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  type AdminChatConversation,
  type AdminChatMessage,
  type AdminChatStatus,
  type SupportCategory,
  adminGateway,
} from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import {
  BagIcon,
  CheckIcon,
  ChevronRightIcon,
  MessageIcon,
  RefreshIcon,
  SearchIcon,
  SendIcon,
  SparkleIcon,
  UsersIcon,
  XIcon,
} from '../../components/ui/icons';
import { useAuth } from '../../context/AuthContext';
import { type ChatRealtimeEvent, useChatRealtime } from '../../hooks/useChatRealtime';
import { errorMessage } from '../../lib/errors';
import { formatDateTime, formatVnd, ORDER_STATUS_LABEL } from '../../lib/format';

export interface AdminSupportPageProps {}

type SupportTab = Extract<AdminChatStatus, 'WAITING_ADMIN' | 'LIVE' | 'CLOSED'>;
type MessagePage = number | 'latest';

const SUPPORT_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: 'DON_HANG', label: 'Đơn hàng' },
  { value: 'SAN_PHAM', label: 'Sản phẩm' },
  { value: 'GIAO_HANG', label: 'Giao hàng' },
  { value: 'THANH_TOAN', label: 'Thanh toán' },
  { value: 'DOI_TRA', label: 'Đổi trả' },
  { value: 'TAI_KHOAN', label: 'Tài khoản' },
  { value: 'KHAC', label: 'Khác' },
];

const TABS: { status: SupportTab; label: string; description: string; badgeColor: string }[] = [
  {
    status: 'WAITING_ADMIN',
    label: 'Chờ tiếp nhận',
    description: 'Khách hàng đang yêu cầu hỗ trợ trực tiếp từ nhân viên tư vấn.',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  {
    status: 'LIVE',
    label: 'Đang hỗ trợ',
    description: 'Cuộc trò chuyện đang có nhân viên trực tiếp trao đổi với khách.',
    badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
  {
    status: 'CLOSED',
    label: 'Lịch sử đã đóng',
    description: 'Các cuộc trò chuyện / ticket hỗ trợ đã hoàn tất và kết thúc.',
    badgeColor: 'bg-sunken text-ink-muted',
  },
];

function isSupportTab(value: string | null): value is SupportTab {
  return value === 'WAITING_ADMIN' || value === 'LIVE' || value === 'CLOSED';
}

function customerName(conversation: AdminChatConversation): string {
  return conversation.user.fullName || conversation.user.email;
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

function chatProducts(message: AdminChatMessage): ChatProductCard[] {
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

function chatSuggestions(message: AdminChatMessage): string[] {
  if (message.senderType !== 'AI' || !isRecord(message.metadata)) return [];
  const suggestions = message.metadata.suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.filter((item): item is string => typeof item === 'string').slice(0, 3);
}

function cleanDisplayContent(raw: string): { content: string; extractedSuggestions?: string[] } {
  const trimmed = raw.trim();
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

  const cleaned = trimmed
    .replace(/```(?:json)?\s*[\s\S]*?```/gi, (match) => {
      return match.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    })
    .replace(/^```(?:json)?/gi, '')
    .replace(/```$/g, '')
    .trim();

  return { content: cleaned || raw };
}

function AdminProductRecommendationCard({ product }: Readonly<{ product: ChatProductCard }>) {
  const variantSummary = product.matchingVariants
    .slice(0, 2)
    .map((variant) => `${variant.color} / ${variant.size}${variant.available ? '' : ' (hết)'}`)
    .join(', ');

  return (
    <Link
      to={`/admin/san-pham/${product.id}`}
      className="group flex gap-2.5 rounded-control border border-line bg-surface p-2 text-ink transition-all hover:border-accent hover:shadow-xs"
    >
      <div className="relative aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-control bg-sunken">
        {product.image ? (
          <img
            src={product.image.thumbUrl}
            alt={product.name}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <BagIcon className="size-4 text-ink-muted" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center text-xs">
        <p className="line-clamp-1 font-semibold group-hover:text-accent">{product.name}</p>
        <p className="tabular mt-0.5 font-bold text-accent">{formatVnd(product.price)}</p>
        {variantSummary ? (
          <p className="mt-0.5 text-[0.6875rem] text-ink-muted truncate">
            Biến thể: <span className="font-medium text-ink">{variantSummary}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
function senderLabel(message: AdminChatMessage): string {
  if (message.senderType === 'USER') return 'Khách hàng';
  if (message.senderType === 'ADMIN') return 'Nhân viên hỗ trợ';
  if (message.senderType === 'AI') return 'Trợ lý AI';
  return 'Hệ thống';
}

async function loadAdminMessages(conversationId: number, requestedPage: MessagePage) {
  if (requestedPage !== 'latest') {
    return adminGateway.chat.detail(conversationId, requestedPage, 100);
  }

  const firstPage = await adminGateway.chat.detail(conversationId, 1, 100);
  if (firstPage.pagination.totalPages <= 1) return firstPage;
  return adminGateway.chat.detail(conversationId, firstPage.pagination.totalPages, 100);
}

export function AdminSupportPage({}: Readonly<AdminSupportPageProps>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const [messagePage, setMessagePage] = useState<MessagePage>('latest');
  const messageEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const statusParam = params.get('status');
  const status: SupportTab = isSupportTab(statusParam) ? statusParam : 'WAITING_ADMIN';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const searchQuery = params.get('q')?.trim() ?? '';
  const [searchDraft, setSearchDraft] = useState(searchQuery);
  const conversationId = Number(params.get('conversation')) || null;

  useEffect(() => {
    setSearchDraft(searchQuery);
  }, [searchQuery]);

  function updateParams(next: {
    status?: SupportTab;
    page?: number;
    conversation?: number | null;
    q?: string | null;
  }) {
    const updated = new URLSearchParams(params);
    if (next.status !== undefined) updated.set('status', next.status);
    if (next.page !== undefined && next.page > 1) updated.set('page', String(next.page));
    else if (next.page !== undefined) updated.delete('page');
    if (next.conversation === null) updated.delete('conversation');
    else if (next.conversation !== undefined) updated.set('conversation', String(next.conversation));
    if (next.q === null) updated.delete('q');
    else if (next.q !== undefined) {
      const trimmed = next.q.trim();
      if (trimmed) updated.set('q', trimmed);
      else updated.delete('q');
    }
    if (next.conversation !== undefined) setMessagePage('latest');
    setParams(updated);
  }

  useEffect(() => {
    setMessagePage('latest');
    setNote('');
  }, [conversationId]);

  const conversations = useQuery({
    queryKey: ['admin', 'chat', 'conversations', { status, page, q: searchQuery }],
    queryFn: () => adminGateway.chat.list({ status, page, limit: 20, q: searchQuery || undefined }),
  });

  // Query counts for tabs
  const waitingCountQuery = useQuery({
    queryKey: ['admin', 'chat', 'conversations', { status: 'WAITING_ADMIN', countOnly: true }],
    queryFn: () => adminGateway.chat.list({ status: 'WAITING_ADMIN', page: 1, limit: 1 }),
    refetchInterval: 15_000,
  });

  const liveCountQuery = useQuery({
    queryKey: ['admin', 'chat', 'conversations', { status: 'LIVE', countOnly: true }],
    queryFn: () => adminGateway.chat.list({ status: 'LIVE', page: 1, limit: 1 }),
    refetchInterval: 15_000,
  });

  const detail = useQuery({
    queryKey: ['admin', 'chat', 'conversation', conversationId, messagePage],
    queryFn: () => loadAdminMessages(conversationId!, messagePage),
    enabled: conversationId !== null,
  });

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'chat'] });
  }, [queryClient]);

  const onRealtimeEvent = useCallback(
    (event: ChatRealtimeEvent) => {
      refreshAll();
      const affectedConversationId =
        event.name === 'message.created' ? event.message.conversationId : event.conversation.id;
      if (affectedConversationId === conversationId) {
        setMessagePage('latest');
        void queryClient.invalidateQueries({
          queryKey: ['admin', 'chat', 'conversation', conversationId],
        });
      }
    },
    [conversationId, queryClient, refreshAll],
  );

  const handleReconnect = useCallback(() => {
    setMessagePage('latest');
    refreshAll();
  }, [refreshAll]);

  const connectionStatus = useChatRealtime({
    enabled: true,
    subscribeAdmin: true,
    conversationId,
    onEvent: onRealtimeEvent,
    onReconnect: handleReconnect,
  });

  const accept = useMutation({
    mutationFn: (id: number) => adminGateway.chat.accept(id),
    onSuccess: ({ conversation }) => {
      setMessagePage('latest');
      refreshAll();
      updateParams({ status: 'LIVE', conversation: conversation.id, page: 1 });
      setTimeout(() => textareaRef.current?.focus(), 150);
    },
  });

  const reply = useMutation({
    mutationFn: (text: string) => adminGateway.chat.send(conversationId!, text),
    onSuccess: () => {
      setContent('');
      setMessagePage('latest');
      refreshAll();
    },
  });

  const close = useMutation({
    mutationFn: (id: number) => adminGateway.chat.close(id),
    onSuccess: ({ conversation }) => {
      setMessagePage('latest');
      refreshAll();
      updateParams({ status: 'CLOSED', conversation: conversation.id, page: 1 });
    },
  });

  const classify = useMutation({
    mutationFn: (category: SupportCategory) => adminGateway.chat.classify(conversationId!, category),
    onSuccess: () => {
      setMessagePage('latest');
      refreshAll();
    },
  });

  const saveNote = useMutation({
    mutationFn: (text: string) => adminGateway.chat.note(conversationId!, text),
    onSuccess: () => {
      setNote('');
      refreshAll();
    },
  });

  const transfer = useMutation({
    mutationFn: (assigneeId: number) => adminGateway.chat.transfer(conversationId!, assigneeId),
    onSuccess: () => {
      setMessagePage('latest');
      refreshAll();
    },
  });

  const agents = useQuery({
    queryKey: ['admin', 'chat', 'agents'],
    queryFn: () => adminGateway.chat.agents(),
  });

  function submitReply(event?: FormEvent) {
    event?.preventDefault();
    const text = content.trim();
    if (text && !reply.isPending) reply.mutate(text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitReply();
    }
  }

  useEffect(() => {
    if (detail.data?.messages.length) {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [detail.data?.messages.length]);

  const selected = detail.data?.conversation ?? null;
  const canReply = selected?.status === 'LIVE' && selected.assignedAdminId === user?.id;
  const canClose = selected?.status === 'WAITING_ADMIN' || canReply;
  const mutationError = accept.error ?? reply.error ?? close.error ?? classify.error ?? saveNote.error ?? transfer.error;
  const activeTab = TABS.find((tab) => tab.status === status)!;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0 overflow-hidden">
      {/* Header section (Compact) */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">Hỗ trợ khách hàng (Live Chat & Tickets)</h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {connectionStatus === 'connected' ? 'Realtime kết nối' : 'Đang kết nối lại...'}
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            Theo dõi yêu cầu tư vấn, tiếp nhận và phản hồi khách hàng theo thời gian thực.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={refreshAll}
          className="inline-flex items-center gap-1.5"
        >
          <RefreshIcon className="size-3.5" />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* Tabs Row with Realtime Counters */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-2.5 shrink-0">
        {TABS.map((tab) => {
          const isActive = tab.status === status;
          const count =
            tab.status === 'WAITING_ADMIN'
              ? waitingCountQuery.data?.pagination.total
              : tab.status === 'LIVE'
                ? liveCountQuery.data?.pagination.total
                : undefined;

          return (
            <button
              key={tab.status}
              type="button"
              onClick={() => updateParams({ status: tab.status, page: 1, conversation: null })}
              className={`inline-flex items-center gap-2 rounded-control border px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? 'border-accent bg-accent-soft text-accent shadow-xs'
                  : 'border-line bg-surface text-ink hover:bg-sunken'
              }`}
            >
              <span>{tab.label}</span>
              {typeof count === 'number' ? (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[0.6875rem] font-bold ${
                    isActive
                      ? 'bg-accent text-accent-ink'
                      : 'bg-sunken text-ink-muted'
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Main Support Grid - Exact fit in remaining viewport height */}
      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(24rem,1.45fr)] overflow-hidden">
        {/* Cột Trái: Danh sách Ticket / Cuộc trò chuyện */}
        <section
          aria-label="Danh sách cuộc trò chuyện"
          className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-xs"
        >
          <div className="space-y-2 border-b border-line bg-sunken/40 px-3.5 py-2.5 shrink-0">
            <h2 className="font-semibold text-xs uppercase tracking-wider text-ink-muted">
              {activeTab.label} ({conversations.data?.pagination.total ?? 0})
            </h2>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                updateParams({ q: searchDraft, page: 1, conversation: null });
              }}
            >
              <label htmlFor="support-search" className="sr-only">
                Lọc hoặc tìm kiếm cuộc trò chuyện
              </label>
              <input
                id="support-search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Tên, email, SĐT hoặc mã cuộc trò chuyện"
                className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
              />
              <Button type="submit" size="sm" variant="secondary" aria-label="Tìm kiếm">
                <SearchIcon className="size-3.5" />
              </Button>
            </form>
          </div>

          {conversations.isPending ? (
            <div className="space-y-2 p-3 flex-1 overflow-y-auto">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : conversations.isError ? (
            <div className="p-4">
              <Alert>{errorMessage(conversations.error)}</Alert>
            </div>
          ) : conversations.data.items.length === 0 ? (
            <div className="p-6 flex-1 flex flex-col justify-center">
              <EmptyState
                title="Không có cuộc trò chuyện"
                description={
                  searchQuery
                    ? `Không có cuộc trò chuyện khớp “${searchQuery}”.`
                    : activeTab.description
                }
                icon={<MessageIcon className="size-8 text-ink-muted/60" />}
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line overflow-y-auto flex-1 min-h-0">
                {conversations.data.items.map((conv) => {
                  const isSelected = conv.id === conversationId;
                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => updateParams({ conversation: conv.id })}
                        className={`w-full p-3 text-left transition-all ${
                          isSelected
                            ? 'bg-accent-soft/50 border-l-4 border-accent'
                            : 'hover:bg-sunken'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-ink truncate">
                            {customerName(conv)}
                          </span>
                          <span className="shrink-0 text-[0.625rem] text-ink-muted">
                            {formatDateTime(conv.updatedAt)}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-ink-muted text-[0.6875rem]">Ticket #{conv.id}</span>
                          {conv.assignedAdmin ? (
                            <span className="text-[0.625rem] text-accent font-medium truncate max-w-[120px]">
                              Phụ trách: {conv.assignedAdmin.fullName || conv.assignedAdmin.email}
                            </span>
                          ) : (
                            <span className="text-[0.625rem] text-amber-600 dark:text-amber-400 font-medium">
                              Chưa tiếp nhận
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {conversations.data.pagination.totalPages > 1 && (
                <div className="border-t border-line p-2 bg-surface shrink-0">
                  <Pagination
                    page={conversations.data.pagination.page}
                    totalPages={conversations.data.pagination.totalPages}
                    onChange={(next) => updateParams({ page: next, conversation: null })}
                  />
                </div>
              )}
            </>
          )}
        </section>

        {/* Cột Phải: Khung chat chi tiết & Điều khiển */}
        <section
          aria-label="Chi tiết cuộc trò chuyện"
          className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-xs"
        >
          {!conversationId ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-ink-muted">
              <div className="space-y-2 max-w-xs">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
                  <MessageIcon className="size-6" />
                </div>
                <h3 className="font-semibold text-ink text-base">Chưa chọn ticket nào</h3>
                <p className="text-xs text-ink-muted">
                  Chọn một cuộc trò chuyện từ danh sách bên trái để xem nội dung và tương tác trực tiếp với khách hàng.
                </p>
              </div>
            </div>
          ) : detail.isPending ? (
            <div className="space-y-3 p-4 flex-1">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : detail.isError ? (
            <div className="p-4">
              <Alert>{errorMessage(detail.error)}</Alert>
            </div>
          ) : (
            <>
              {/* Chat Header (Fixed at top) */}
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 shadow-xs shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-ink font-bold text-xs">
                    <UsersIcon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-semibold text-sm text-ink">
                        {customerName(detail.data.conversation)}
                      </h2>
                      <span className="font-mono text-xs text-ink-muted">
                        #Ticket {detail.data.conversation.id}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted truncate">
                      {detail.data.conversation.user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {detail.data.conversation.status === 'WAITING_ADMIN' ? (
                    <Button
                      size="sm"
                      onClick={() => accept.mutate(detail.data.conversation.id)}
                      loading={accept.isPending}
                      className="inline-flex items-center gap-1.5"
                    >
                      <CheckIcon className="size-3.5" />
                      <span>Tiếp nhận chat</span>
                    </Button>
                  ) : null}

                  {canClose ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => close.mutate(detail.data.conversation.id)}
                      loading={close.isPending}
                      className="inline-flex items-center gap-1.5"
                    >
                      <XIcon className="size-3.5" />
                      <span>Đánh dấu đã xử lý</span>
                    </Button>
                  ) : null}
                </div>
              </header>

              <section aria-label="Thông tin khách hàng" className="shrink-0 border-b border-line bg-sunken/40 px-4 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-ink">{detail.data.customer.fullName}</p>
                    <p className="text-ink-muted">{detail.data.customer.email}</p>
                    <p className="text-ink-muted">{detail.data.customer.phone || 'Chưa có số điện thoại'}</p>
                    <p className="mt-1 text-ink">
                      {detail.data.customer.address
                        ? `${detail.data.customer.address.line1}, ${detail.data.customer.address.ward}, ${detail.data.customer.address.district}, ${detail.data.customer.address.province}`
                        : 'Chưa có địa chỉ'}
                    </p>
                  </div>
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-ink-muted">Đơn gần đây</p>
                    {detail.data.customer.orders.length === 0 ? (
                      <p className="text-ink-muted">Chưa có đơn hàng</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {detail.data.customer.orders.map((order) => (
                          <li key={order.id}>
                            <span className="font-medium text-ink">{order.code}</span>
                            <span className="text-ink-muted">
                              {' '}
                              · {ORDER_STATUS_LABEL[order.status]} · {formatVnd(order.total)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              {canReply ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 shrink-0">
                  <label htmlFor="support-category" className="text-xs font-medium text-ink">
                    Phân loại yêu cầu
                  </label>
                  <select
                    id="support-category"
                    value={detail.data.classification?.category ?? ''}
                    disabled={classify.isPending}
                    onChange={(event) => {
                      const category = event.target.value as SupportCategory;
                      if (category) classify.mutate(category);
                    }}
                    className="rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                  >
                    <option value="">Chọn loại yêu cầu</option>
                    {SUPPORT_CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="support-transfer" className="text-xs font-medium text-ink">
                    Chuyển nhân viên
                  </label>
                  <select
                    id="support-transfer"
                    value=""
                    disabled={transfer.isPending}
                    onChange={(event) => {
                      const assigneeId = Number(event.target.value);
                      if (assigneeId) transfer.mutate(assigneeId);
                    }}
                    className="rounded-control border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                  >
                    <option value="">Chọn nhân viên khác</option>
                    {(agents.data?.agents ?? [])
                      .filter((agent) => agent.id !== user?.id)
                      .map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.fullName || agent.email}
                        </option>
                      ))}
                  </select>
                </div>
              ) : detail.data.classification ? (
                <p className="shrink-0 border-b border-line px-4 py-2 text-xs text-ink-muted">
                  Phân loại: <span className="font-medium text-ink">{detail.data.classification.label}</span>
                </p>
              ) : null}

              {/* Phân trang tin nhắn nếu quá dài */}
              {detail.data.pagination.totalPages > 1 ? (
                <nav
                  aria-label="Phân trang tin nhắn hỗ trợ"
                  className="flex items-center justify-center gap-3 border-b border-line px-3 py-1.5 text-xs bg-sunken/60 shrink-0"
                >
                  <button
                    type="button"
                    disabled={detail.data.pagination.page <= 1}
                    onClick={() => setMessagePage(detail.data.pagination.page - 1)}
                    className="rounded-control border border-line px-2 py-1 font-medium hover:bg-surface disabled:opacity-40"
                  >
                    Tin cũ hơn
                  </button>
                  <span className="text-ink-muted text-[0.6875rem]">
                    Trang {detail.data.pagination.page}/{detail.data.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={detail.data.pagination.page >= detail.data.pagination.totalPages}
                    onClick={() => setMessagePage(detail.data.pagination.page + 1)}
                    className="rounded-control border border-line px-2 py-1 font-medium hover:bg-surface disabled:opacity-40"
                  >
                    Tin mới hơn
                  </button>
                </nav>
              ) : null}

              {/* Messages Body (Scrollable Center Area) */}
              <div
                className="flex-1 min-h-0 space-y-3 overflow-y-auto bg-canvas/40 p-4"
                aria-live="polite"
                aria-label="Lịch sử trao đổi"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Lịch sử trao đổi</h3>
                {detail.data.messages.length === 0 ? (
                  <p className="py-12 text-center text-sm text-ink-muted">Chưa có tin nhắn nào trong cuộc trò chuyện này.</p>
                ) : (
                  detail.data.messages.map((message) => {
                    const isStaff = message.senderType === 'ADMIN';
                    const isSystem = message.senderType === 'SYSTEM';
                    const isAi = message.senderType === 'AI';
                    const products = chatProducts(message);
                    const rawSuggestions = chatSuggestions(message);
                    const { content: displayContent, extractedSuggestions } = cleanDisplayContent(
                      message.content,
                    );
                    const suggestions =
                      rawSuggestions.length > 0
                        ? rawSuggestions
                        : (extractedSuggestions ?? []);

                    if (isSystem) {
                      return (
                        <div key={message.id} className="flex justify-center my-2">
                          <span className="rounded-full bg-sunken px-3 py-1 text-center text-xs text-ink-muted border border-line">
                            {displayContent}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={`flex items-end gap-2 ${
                          isStaff ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {!isStaff && (
                          <span
                            className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                              isAi ? 'bg-accent/15 text-accent' : 'bg-sunken text-ink-muted'
                            }`}
                            title={isAi ? 'Trợ lý AI' : 'Khách hàng'}
                          >
                            {isAi ? <SparkleIcon className="size-3.5" /> : <UsersIcon className="size-3.5" />}
                          </span>
                        )}

                        <div className={`max-w-[85%] space-y-1 ${isStaff ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`flex items-center gap-1.5 text-[0.6875rem] text-ink-muted px-1 ${
                              isStaff ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <span className="font-semibold">{senderLabel(message)}</span>
                            <span>·</span>
                            <time dateTime={message.createdAt}>
                              {formatDateTime(message.createdAt)}
                            </time>
                          </div>

                          <div
                            className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-xs ${
                              isStaff
                                ? 'rounded-br-xs bg-accent text-accent-ink'
                                : isAi
                                  ? 'rounded-bl-xs border border-accent/30 bg-accent-soft/25 text-ink'
                                  : 'rounded-bl-xs border border-line bg-surface text-ink'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{displayContent}</p>

                            {/* Render AI recommended products if available */}
                            {products.length > 0 ? (
                              <div className="mt-2.5 space-y-1.5 border-t border-line/60 pt-2">
                                <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-muted">
                                  Sản phẩm AI gợi ý ({products.length}):
                                </p>
                                <div className="space-y-1.5">
                                  {products.map((prod) => (
                                    <AdminProductRecommendationCard key={prod.id} product={prod} />
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {/* Render suggestions if any */}
                            {suggestions.length > 0 ? (
                              <div className="mt-2 border-t border-line/40 pt-1.5">
                                <p className="text-[0.6875rem] text-ink-muted">Gợi ý câu hỏi AI gửi:</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {suggestions.map((sug) => (
                                    <span
                                      key={sug}
                                      className="rounded-full bg-surface border border-line px-2 py-0.5 text-[0.6875rem] text-ink-muted"
                                    >
                                      {sug}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </div>

              {/* Chat Input / Action Footer (Fixed at bottom) */}
              <section aria-label="Ghi chú cuộc trò chuyện" className="shrink-0 space-y-2 border-t border-line bg-sunken/30 px-3 py-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Ghi chú nội bộ</h3>
                {detail.data.notes.length === 0 ? (
                  <p className="text-xs text-ink-muted">Chưa có ghi chú. Khách hàng không thấy phần này.</p>
                ) : (
                  <ul className="max-h-24 space-y-1 overflow-y-auto">
                    {detail.data.notes.map((item) => (
                      <li key={item.id} className="text-xs text-ink">
                        <span className="font-medium">{item.author?.fullName || 'Nhân viên'}</span>
                        <span className="text-ink-muted"> · {formatDateTime(item.createdAt)} · </span>
                        <span className="whitespace-pre-wrap">{item.content}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = note.trim();
                    if (text && !saveNote.isPending) saveNote.mutate(text);
                  }}
                >
                  <label htmlFor="support-note" className="sr-only">
                    Ghi chú cuộc trò chuyện
                  </label>
                  <input
                    id="support-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Thêm ghi chú cho nhân viên"
                    className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                  />
                  <Button type="submit" size="sm" variant="secondary" disabled={!note.trim()} loading={saveNote.isPending}>
                    Lưu ghi chú
                  </Button>
                </form>
              </section>

              <div className="space-y-2 border-t border-line bg-surface p-3 shrink-0">
                {mutationError ? <Alert>{errorMessage(mutationError)}</Alert> : null}

                {canReply ? (
                  <form onSubmit={submitReply} className="space-y-2">
                    <div className="relative">
                      <label htmlFor="admin-support-message" className="sr-only">
                        Nội dung phản hồi khách hàng
                      </label>
                      <textarea
                        ref={textareaRef}
                        id="admin-support-message"
                        rows={2}
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập nội dung phản hồi khách hàng (Enter để gửi, Shift+Enter xuống dòng)…"
                        className="w-full resize-none rounded-xl border border-line bg-sunken px-3.5 py-2 text-sm outline-none transition focus:border-accent focus:bg-surface"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[0.6875rem] text-ink-muted">
                        Nhấn <strong>Enter</strong> để gửi tin nhắn ngay
                      </p>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!content.trim()}
                        loading={reply.isPending}
                        className="inline-flex items-center gap-1.5 px-4"
                      >
                        <span>Gửi phản hồi</span>
                        <SendIcon className="size-3.5" />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-control bg-sunken/60 p-2.5 text-center text-xs text-ink-muted">
                    {detail.data.conversation.status === 'WAITING_ADMIN' ? (
                      <div className="flex items-center justify-center gap-2">
                        <span>Cuộc trò chuyện đang chờ hỗ trợ. Hãy tiếp nhận để trả lời khách.</span>
                        <Button
                          size="sm"
                          onClick={() => accept.mutate(detail.data.conversation.id)}
                          loading={accept.isPending}
                        >
                          Tiếp nhận ngay
                        </Button>
                      </div>
                    ) : detail.data.conversation.status === 'CLOSED' ? (
                      <span>Cuộc trò chuyện này đã được đánh dấu đã xử lý.</span>
                    ) : (
                      <span>
                        Cuộc trò chuyện đã được phân công cho nhân viên{' '}
                        <strong>
                          {detail.data.conversation.assignedAdmin?.fullName ?? 'khác'}
                        </strong>
                        .
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
