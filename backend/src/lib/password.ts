import { compare, hash } from 'bcryptjs';
import { isTest } from '../config/env.js';

/**
 * bcryptjs là bản thuần JavaScript nên không cần trình biên dịch C++ —
 * quan trọng trên Windows, nơi gói `bcrypt` gốc thường lỗi khi cài.
 *
 * Cost 10 là mức thông dụng cho web. Riêng khi chạy test hạ xuống 4: mỗi lần
 * hash ở cost 10 tốn khoảng 100ms, nhân với hàng chục lần tạo tài khoản trong
 * test sẽ kéo dài bộ test một cách vô ích.
 */
const COST = isTest ? 4 : 10;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, COST);
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash);
}
