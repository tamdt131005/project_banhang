import { ApiError } from '../api/client';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/**
 * Trải lỗi VALIDATION_ERROR của backend thành map { tên trường: thông báo }.
 *
 * Backend đã trả lỗi theo từng trường rồi, nên form chỉ việc gắn vào đúng ô
 * thay vì dồn tất cả vào một dòng đỏ chung chung ở đầu form.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') return {};
  if (!Array.isArray(error.details)) return {};

  const result: Record<string, string> = {};
  for (const item of error.details) {
    if (
      item !== null &&
      typeof item === 'object' &&
      'field' in item &&
      'message' in item &&
      typeof item.field === 'string' &&
      typeof item.message === 'string'
    ) {
      result[item.field] = item.message;
    }
  }
  return result;
}
