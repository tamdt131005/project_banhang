import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { env, isProduction } from '../config/env.js';

/**
 * Chuyển `mysql://user:pass@host:port/db` thành object cấu hình pool.
 *
 * Không truyền thẳng chuỗi kết nối vào adapter được: driver `mariadb` chỉ
 * chấp nhận scheme `mariadb://` (xem regex trong lib/config/connection-options.js),
 * còn Prisma CLI lại bắt buộc `mysql://` cho provider mysql. Tách ra ở đây để
 * cả CLI lẫn runtime dùng chung đúng một biến DATABASE_URL.
 */
function poolConfigFromUrl(databaseUrl: string) {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error(
      `DATABASE_URL không phải URL hợp lệ: ${databaseUrl}\n` +
        'Định dạng đúng: mysql://user:matkhau@localhost:3306/ten_database',
    );
  }

  const database = url.pathname.replace(/^\//, '');
  if (!database) {
    throw new Error('DATABASE_URL thiếu tên database ở cuối, ví dụ: .../agentchuan_shop');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 10,
  };
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaMariaDb(poolConfigFromUrl(env.DATABASE_URL)),
    log: isProduction ? ['error'] : ['warn', 'error'],
  });
}

/**
 * `tsx watch` nạp lại module mỗi lần sửa file. Không giữ client trên globalThis
 * thì mỗi lần lưu sẽ sinh thêm một pool kết nối mới, và database sớm muộn cũng
 * báo "Too many connections".
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
