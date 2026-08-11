import 'dotenv/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Ép test chạy trên database riêng. Gán ở đây (chứ không trong setup) để
    // biến có mặt trước khi bất kỳ module nào đọc process.env — dotenv không
    // ghi đè biến đã tồn tại nên .env sẽ không kéo ngược về database thật.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? '',
    },
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Các file test dùng chung một database và cùng xoá sạch bảng trước mỗi
    // case, nên chạy song song sẽ giẫm lên nhau.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
