/**
 * Đổi tiêu đề tiếng Việt thành slug ASCII: "Điện thoại Xiaomi" → "dien-thoai-xiaomi".
 *
 * NFD tách nguyên âm khỏi dấu thanh nên xoá được toàn bộ dấu bằng một biểu
 * thức. Riêng "đ"/"Đ" là chữ cái độc lập, không phải chữ có dấu, nên NFD
 * không tách ra được — phải thay thủ công trước khi lọc.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    // U+0300–U+036F là dải dấu thanh tổ hợp mà NFD vừa tách ra.
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

/**
 * Thêm hậu tố -2, -3... cho tới khi slug chưa được dùng.
 * `isTaken` nhận slug và trả về true nếu đã có bản ghi khác dùng slug đó.
 */
export async function uniqueSlug(
  source: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(source) || 'muc';

  if (!(await isTaken(base))) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`Không tạo được slug duy nhất từ "${source}"`);
}
