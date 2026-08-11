import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { resetAllRateLimits } from '../src/middleware/rateLimit.js';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const EXPECTED_TEST_DATABASE = 'agentchuan_shop_test';

function exactDatabaseName(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL của bộ test không phải URL MySQL hợp lệ; đã dừng trước khi xoá dữ liệu.');
  }

  if (parsed.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL của bộ test phải dùng giao thức mysql:; đã dừng trước khi xoá dữ liệu.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!databaseName || databaseName.includes('/')) {
    throw new Error('DATABASE_URL của bộ test thiếu tên database hợp lệ; đã dừng trước khi xoá dữ liệu.');
  }
  return databaseName;
}

// Chốt chặn thứ hai, phòng khi vitest.config.ts bị sửa sai: thà bộ test không
// chạy được còn hơn xoá sạch database thật.
const databaseName = exactDatabaseName(databaseUrl);
if (databaseName !== EXPECTED_TEST_DATABASE) {
  throw new Error(
    `Bộ test phải trỏ chính xác tới database "${EXPECTED_TEST_DATABASE}"; ` +
      `đã nhận tên "${databaseName}" và dừng trước khi xoá dữ liệu.`,
  );
}

beforeEach(async () => {
  // Xoá theo thứ tự phụ thuộc khoá ngoại: con trước, cha sau.
  await prisma.inventoryMovement.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  // Danh mục con trước danh mục cha (khoá ngoại tự tham chiếu).
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Bộ đếm rate limit nằm trong bộ nhớ và sống xuyên suốt tiến trình test,
  // nên không xoá thì case kiểm tra rate limit sẽ làm hỏng mọi case sau.
  await resetAllRateLimits();
});

afterAll(async () => {
  await prisma.$disconnect();
});
