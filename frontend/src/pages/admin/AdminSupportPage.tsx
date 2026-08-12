import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type AdminChatConversation,
  type AdminChatMessage,
  type AdminChatStatus,
  adminGateway,
} from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { MessageIcon, UsersIcon } from '../../components/ui/icons';
import { useAuth } from '../../context/AuthContext';
import { type ChatRealtimeEvent, useChatRealtime } from '../../hooks/useChatRealtime';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';

export interface AdminSupportPageProps {}

type SupportTab = Extract<AdminChatStatus, 'WAITING_ADMIN' | 'LIVE' | 'CLOSED'>;
type MessagePage = number | 'latest';

const TABS: { status: SupportTab; label: string; description: string }[] = [
  { status: 'WAITING_ADMIN', label: 'Đang chờ', description: 'Cuộc trò chuyện chờ nhân viên tiếp nhận.' },
  { status: 'LIVE', label: 'Đang hỗ trợ', description: 'Cuộc trò chuyện đã có nhân viên phụ trách.' },
  { status: 'CLOSED', label: 'Đã đóng', description: 'Lịch sử cuộc trò chuyện đã kết thúc.' },
];

function isSupportTab(value: string | null): value is SupportTab {
  return value === 'WAITING_ADMIN' || value === 'LIVE' || value === 'CLOSED';
}

function customerName(conversation: AdminChatConversation): string {
  return conversation.user.fullName;
}

function senderLabel(message: AdminChatMessage): string {
  if (message.senderType === 'USER') return 'Khách hàng';
  if (message.senderType === 'ADMIN') return 'Nhân viên hỗ trợ';
  if (message.senderType === 'AI') return 'Trợ lý';
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
  const [messagePage, setMessagePage] = useState<MessagePage>('latest');

  const statusParam = params.get('status');
  const status: SupportTab = isSupportTab(statusParam) ? statusParam : 'WAITING_ADMIN';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const conversationId = Number(params.get('conversation')) || null;

  function updateParams(next: { status?: SupportTab; page?: number; conversation?: number | null }) {
    const updated = new URLSearchParams(params);
    if (next.status !== undefined) updated.set('status', next.status);
    if (next.page !== undefined && next.page > 1) updated.set('page', String(next.page));
    else if (next.page !== undefined) updated.delete('page');
    if (next.conversation === null) updated.delete('conversation');
    else if (next.conversation !== undefined) updated.set('conversation', String(next.conversation));
    if (next.conversation !== undefined) setMessagePage('latest');
    setParams(updated);
  }

  useEffect(() => setMessagePage('latest'), [conversationId]);

  const conversations = useQuery({
    queryKey: ['admin', 'chat', 'conversations', { status, page }],
    queryFn: () => adminGateway.chat.list({ status, page, limit: 20 }),
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

  function submitReply(event: FormEvent) {
    event.preventDefault();
    const text = content.trim();
    if (text) reply.mutate(text);
  }

  const selected = detail.data?.conversation ?? null;
  const canReply = selected?.status === 'LIVE' && selected.assignedAdminId === user?.id;
  const mutationError = accept.error ?? reply.error ?? close.error;
  const activeTab = TABS.find((tab) => tab.status === status)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hỗ trợ khách hàng</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Tiếp nhận và trả lời cuộc trò chuyện theo thời gian thực.</p>
        </div>
        <p className="text-xs text-ink-muted">
          {connectionStatus === 'connected' ? 'Realtime đã kết nối' : 'Đang kết nối realtime…'}
        </p>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => updateParams({ status: tab.status, page: 1, conversation: null })}
            className={`shrink-0 rounded-control border px-3 py-2 text-sm font-medium ${
              tab.status === status
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-surface hover:bg-sunken'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink-muted">{activeTab.description}</p>

      <div className="grid min-h-[34rem] gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(24rem,1.5fr)]">
        <section aria-label="Danh sách cuộc trò chuyện" className="overflow-hidden rounded-card border border-line bg-surface">
          {conversations.isPending ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : conversations.isError ? (
            <div className="p-3"><Alert>{errorMessage(conversations.error)}</Alert></div>
          ) : conversations.data.items.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title="Không có cuộc trò chuyện"
                description={activeTab.description}
                icon={<MessageIcon className="size-6" />}
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {conversations.data.items.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => updateParams({ conversation: conversation.id })}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-sunken ${
                        conversation.id === conversationId ? 'bg-accent-soft' : ''
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{customerName(conversation)}</span>
                        <span className="shrink-0 text-[0.6875rem] text-ink-muted">
                          {formatDateTime(conversation.updatedAt)}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-muted">
                        Cuộc trò chuyện #{conversation.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-3 pb-3">
                <Pagination
                  page={conversations.data.pagination.page}
                  totalPages={conversations.data.pagination.totalPages}
                  onChange={(next) => updateParams({ page: next, conversation: null })}
                />
              </div>
            </>
          )}
        </section>

        <section aria-label="Chi tiết cuộc trò chuyện" className="flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
          {!conversationId ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-sm text-ink-muted">
              <div>
                <MessageIcon className="mx-auto mb-3 size-9 text-accent" />
                Chọn một cuộc trò chuyện để xem chi tiết.
              </div>
            </div>
          ) : detail.isPending ? (
            <div className="space-y-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-72" /></div>
          ) : detail.isError ? (
            <div className="p-4"><Alert>{errorMessage(detail.error)}</Alert></div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                <span className="grid size-9 place-items-center rounded-full bg-sunken"><UsersIcon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{customerName(detail.data.conversation)}</h2>
                  <p className="text-xs text-ink-muted">
                    {detail.data.conversation.user.email}
                  </p>
                </div>
                {detail.data.conversation.status === 'WAITING_ADMIN' ? (
                  <Button size="sm" onClick={() => accept.mutate(detail.data.conversation.id)} loading={accept.isPending}>
                    Tiếp nhận
                  </Button>
                ) : null}
                {canReply ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => close.mutate(detail.data.conversation.id)}
                    loading={close.isPending}
                  >
                    Đóng cuộc trò chuyện
                  </Button>
                ) : null}
              </header>

              {detail.data.pagination.totalPages > 1 ? (
                <nav
                  aria-label="Phân trang tin nhắn hỗ trợ"
                  className="flex items-center justify-center gap-3 border-b border-line px-3 py-2 text-xs"
                >
                  <button
                    type="button"
                    disabled={detail.data.pagination.page <= 1}
                    onClick={() => setMessagePage(detail.data.pagination.page - 1)}
                    className="rounded-control border border-line px-2.5 py-1.5 font-medium hover:bg-sunken disabled:opacity-40"
                  >
                    Tin cũ hơn
                  </button>
                  <span className="text-ink-muted">
                    Trang {detail.data.pagination.page}/{detail.data.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={detail.data.pagination.page >= detail.data.pagination.totalPages}
                    onClick={() => setMessagePage(detail.data.pagination.page + 1)}
                    className="rounded-control border border-line px-2.5 py-1.5 font-medium hover:bg-sunken disabled:opacity-40"
                  >
                    Tin mới hơn
                  </button>
                </nav>
              ) : null}

              <div className="flex-1 space-y-3 overflow-y-auto bg-sunken/40 p-4" aria-live="polite">
                {detail.data.messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-ink-muted">Chưa có tin nhắn.</p>
                ) : (
                  detail.data.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`max-w-[85%] rounded-control border border-line px-3 py-2 text-sm ${
                        message.senderType === 'ADMIN' ? 'ml-auto bg-accent text-accent-ink' :
                        message.senderType === 'SYSTEM' ? 'mx-auto bg-sunken text-ink-muted' : 'mr-auto bg-surface'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[0.6875rem] opacity-70">
                        <span className="font-semibold">{senderLabel(message)}</span>
                        <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                      </div>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </article>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t border-line p-3">
                {mutationError ? <Alert>{errorMessage(mutationError)}</Alert> : null}
                {canReply ? (
                  <form onSubmit={submitReply} className="flex gap-2">
                    <label htmlFor="admin-support-message" className="sr-only">Nội dung phản hồi</label>
                    <textarea
                      id="admin-support-message"
                      rows={2}
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder="Nhập phản hồi…"
                      className="min-h-11 flex-1 resize-none rounded-control border border-line bg-sunken px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <Button type="submit" size="sm" disabled={!content.trim()} loading={reply.isPending}>Gửi</Button>
                  </form>
                ) : (
                  <p className="text-center text-xs text-ink-muted">
                    {detail.data.conversation.status === 'WAITING_ADMIN'
                      ? 'Tiếp nhận cuộc trò chuyện trước khi phản hồi.'
                      : detail.data.conversation.status === 'CLOSED'
                        ? 'Cuộc trò chuyện đã kết thúc.'
                        : 'Chỉ nhân viên được phân công mới có thể phản hồi.'}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
