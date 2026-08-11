import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Cấu hình cho Prisma CLI (migrate, studio, db push...).
 *
 * Từ Prisma 7, chuỗi kết nối không còn khai báo trong schema.prisma nữa.
 * Runtime lấy kết nối qua driver adapter ở src/lib/prisma.ts, còn CLI lấy ở đây.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
