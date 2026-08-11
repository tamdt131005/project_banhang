import { execSync } from 'node:child_process';

const EXPECTED_TEST_DATABASE = 'agentchuan_shop_test';

function exactDatabaseName(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL không phải URL MySQL hợp lệ; đã dừng trước khi chạm database.');
  }

  if (parsed.protocol !== 'mysql:') {
    throw new Error('TEST_DATABASE_URL phải dùng giao thức mysql:; đã dừng trước khi chạm database.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!databaseName || databaseName.includes('/')) {
    throw new Error('TEST_DATABASE_URL thiếu tên database hợp lệ; đã dừng trước khi chạm database.');
  }
  return databaseName;
}

/**
 * Áp dụng migration lên database test một lần trước cả bộ test.
 *
 * Dùng `migrate deploy` chứ không phải `db push --accept-data-loss`: lệnh này
 * chỉ áp dụng migration tiến lên, không bao giờ xoá bảng hay cột. Nó cũng
 * idempotent nên chạy lại nhiều lần vẫn an toàn.
 */
export default function setup() {
  const url = process.env['TEST_DATABASE_URL'];

  if (!url) {
    throw new Error(
      'Thiếu TEST_DATABASE_URL trong backend/.env.\n' +
        'Thêm dòng: TEST_DATABASE_URL="mysql://root:@localhost:3306/agentchuan_shop_test"',
    );
  }

  const databaseName = exactDatabaseName(url);
  if (databaseName !== EXPECTED_TEST_DATABASE) {
    throw new Error(
      `TEST_DATABASE_URL phải trỏ chính xác tới database "${EXPECTED_TEST_DATABASE}"; ` +
        `đã nhận tên "${databaseName}" và dừng trước khi chạm database.`,
    );
  }

  // `migrate deploy` không nhận cờ --url, chỉ đọc DATABASE_URL qua
  // prisma.config.ts, nên truyền vào bằng biến môi trường của tiến trình con.
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? String(error);
    throw new Error(
      `Không áp dụng được migration lên database test.\n${stderr}\n` +
        'Kiểm tra MySQL trong Laragon đã bật và database agentchuan_shop_test đã tồn tại chưa.',
    );
  }
}
