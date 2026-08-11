export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Nhiều request cùng nhận 401 một lúc là chuyện bình thường khi access token
 * hết hạn giữa lúc trang đang tải. Gom chung vào một lần gọi /refresh, nếu
 * không sẽ có 5-6 lần xoay vòng token song song và tất cả trừ một cái đều
 * thất bại vì token cũ vừa bị thu hồi.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function send<T>(path: string, init: RequestInit, allowRetry: boolean): Promise<T> {
  const isFormData = init.body instanceof FormData;

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      // FormData tự đặt Content-Type kèm boundary, ghi đè sẽ làm hỏng upload.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });

  // Không thử làm mới cho chính các endpoint auth: /login trả 401 khi sai mật
  // khẩu, gọi /refresh lúc đó vừa vô nghĩa vừa che mất lỗi thật.
  if (response.status === 401 && allowRetry && !path.startsWith('/api/auth/')) {
    if (await refreshSession()) {
      return send<T>(path, init, false);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const payload = (body as { error?: ApiErrorPayload } | null)?.error;
    throw new ApiError(
      response.status,
      payload?.code ?? 'UNKNOWN',
      payload?.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.',
      payload?.details,
    );
  }

  return body as T;
}

function withQuery(path: string, query?: Record<string, string | number | undefined>): string {
  if (!query) return path;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | number | undefined>) =>
    send<T>(withQuery(path, query), { method: 'GET' }, true),

  post: <T>(path: string, body?: unknown) =>
    send<T>(
      path,
      {
        method: 'POST',
        ...(body === undefined
          ? {}
          : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      },
      true,
    ),

  patch: <T>(path: string, body?: unknown) =>
    send<T>(
      path,
      { method: 'PATCH', ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
      true,
    ),

  delete: <T>(path: string) => send<T>(path, { method: 'DELETE' }, true),
};
