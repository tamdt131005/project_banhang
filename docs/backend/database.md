# Database runbook — DB-AUTH-001

## SPEC-BANNER-001 — migration additive development

Migration `20260815230000_home_banners` chỉ tạo bảng `banners`, enum vị trí `HOME_HERO` và index phục vụ truy vấn công khai; không backfill hay sửa bảng hiện có. Backup development đã được tạo tại `D:\nodejs\projectcv-backups\agentchuan_shop-before-banner-20260815-225312.sql` trước khi apply.

Target được phép là duy nhất database development `agentchuan_shop`. Main agent giữ quyền apply; coder không chạy migration. Sau apply, xác minh read-only bảng/index khớp schema, `SELECT COUNT(*) FROM banners` thành công và `/api/banners?placement=HOME_HERO` trả danh sách tăng theo `sortOrder,id`. Rollback khi migration lỗi trước khi mở writer là phục hồi full backup đã xác minh; khi migration thành công nhưng cần rollback code, có thể giữ bảng additive rỗng. Không drop bảng hoặc restore nếu chưa có lệnh riêng của main agent.

Runbook này chỉ áp dụng cho local development database `agentchuan_shop` và local test database `agentchuan_shop_test`. Production, staging và mọi database khác nằm ngoài ủy quyền.

## Phạm vi migration

Migration `20260807120000_order_inventory_audit` là additive:

- tạo `order_status_history` và `inventory_movements` cùng enum, index, unique `operationKey`, foreign key;
- backfill đúng một `BASELINE` cho mỗi order hiện có và mỗi variant hiện có;
- giữ `occurredAt = NULL` cho order baseline;
- không update/delete business row hiện có và không chạy seed.

MySQL DDL auto-commit; không giả định toàn bộ file migration có thể rollback transactionally.

## Gate trước migration development

1. Dừng backend và mọi writer vào `agentchuan_shop`.
2. Parse `DATABASE_URL`; pathname decoded phải bằng chính xác `agentchuan_shop`. Sai hoặc malformed thì dừng mà không in URL/credential.
3. Ghi nhận pre-migration metrics:
   - tổng order;
   - phân bố order theo `status`;
   - tổng variant;
   - tổng `stock` của variant.
4. Tạo backup tại `D:\nodejs\projectcv-backups\SPEC-BE-001` trước migration.
5. Chưa cho writer hoạt động lại cho tới khi toàn bộ verification đạt.

## Backup

Tên artifact bắt buộc:

```text
agentchuan_shop_pre_BE001_<timestamp>.sql
agentchuan_shop_pre_BE001_<timestamp>.sql.sha256
agentchuan_shop_pre_BE001_<timestamp>_manifest.txt
```

Credential chỉ được nhập qua prompt/cấu hình bảo vệ; không đặt password trong command, shell history, manifest hay log. Ví dụ local client (điền host/user đã xác minh, `--password` không kèm giá trị):

```powershell
$dump = 'D:\nodejs\projectcv-backups\SPEC-BE-001\agentchuan_shop_pre_BE001_<timestamp>.sql'
mysqldump.exe --no-defaults --single-transaction --routines --triggers --events --hex-blob --host=localhost --port=3306 --user=<user> --password agentchuan_shop > $dump
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $dump).Hash.ToLowerInvariant()
"$hash  $(Split-Path -Leaf $dump)" | Set-Content -Encoding ascii -LiteralPath "$dump.sha256"
```

Manifest ghi timestamp, exact database name, migration target, metrics trước migration, tên dump và SHA-256; không ghi secret. Giữ backup tới khi khách hàng acceptance; xoá backup chưa được ủy quyền.

## Apply

Sau khi backup và metrics đã xác minh, từ `backend/`:

```powershell
npx prisma migrate deploy
```

Không dùng `db push`, không tự sửa `_prisma_migrations`, không chạy seed.

Test database dùng cùng migration qua Vitest global setup. Destructive fixture reset chỉ được phép khi exact-name guard xác nhận `agentchuan_shop_test`.

## Verification trước khi mở writer

Phải kiểm tra tất cả:

1. `orders` count và phân bố status bằng pre-migration metrics.
2. `product_variants` count và tổng stock bằng pre-migration metrics.
3. Số `ORDER_BASELINE:*` bằng số order có trước migration; mỗi order đúng một record.
4. Mọi order `BASELINE` có `fromStatus IS NULL`, `occurredAt IS NULL`, `toStatus = orders.status`.
5. Số `INVENTORY_BASELINE:*` bằng số variant có trước migration; `beforeStock IS NULL`, `delta IS NULL`, `afterStock = product_variants.stock`.
6. Không có `operationKey` trùng.
7. Prisma validate/generate, TypeScript, test suite và `/api/health` đạt.

Các truy vấn verification chỉ đọc:

```sql
SELECT COUNT(*) FROM orders;
SELECT status, COUNT(*) FROM orders GROUP BY status ORDER BY status;
SELECT COUNT(*) AS variants, COALESCE(SUM(stock), 0) AS stock_units FROM product_variants;

SELECT orderId, COUNT(*) AS n
FROM order_status_history
WHERE type = 'BASELINE'
GROUP BY orderId HAVING n <> 1;

SELECT COUNT(*)
FROM order_status_history h
JOIN orders o ON o.id = h.orderId
WHERE h.type = 'BASELINE'
  AND (h.fromStatus IS NOT NULL OR h.occurredAt IS NOT NULL OR h.toStatus <> o.status);

SELECT variantId, COUNT(*) AS n
FROM inventory_movements
WHERE type = 'BASELINE'
GROUP BY variantId HAVING n <> 1;

SELECT COUNT(*)
FROM inventory_movements m
JOIN product_variants v ON v.id = m.variantId
WHERE m.type = 'BASELINE'
  AND (m.beforeStock IS NOT NULL OR m.delta IS NOT NULL OR m.afterStock <> v.stock);

SELECT operationKey, COUNT(*) AS n
FROM (
  SELECT operationKey FROM order_status_history
  UNION ALL
  SELECT operationKey FROM inventory_movements
) keys_all
GROUP BY operationKey HAVING n > 1;
```

Hai bảng có namespace operation key riêng; truy vấn cuối còn phát hiện collision logic xuyên hai ledger dù database unique constraint áp dụng theo từng bảng.

## Rollback

### SPEC-CHAT-001 additive migration

Migration `20260811215500_chat_human_support` chỉ tạo `conversations`, `chat_messages`, foreign keys và các index timeline/queue; không sửa hoặc backfill Product, Order hay Promotion. Development target là `agentchuan_shop`, test target là database riêng `agentchuan_shop_test`. Không dùng `migrate reset`.

Sau migrate, xác minh read-only: hai bảng tồn tại; enum/status, foreign key và index khớp schema; `_prisma_migrations` ghi migration thành công; row counts của các bảng cũ khớp manifest trước migration. Nếu verification thất bại trước khi mở writer, giữ writer dừng và khôi phục full development backup đã kiểm SHA-256 theo DB-AUTH-CHAT-001. Database test được phép làm sạch fixture và không cần backup.

### SPEC-CHAT-002 additive migration

Migration `20260813093000_chat_ai_assistant` chỉ thêm `activeAiRunId`, `activeAiRunStartedAt` và index `Conversation(status, activeAiRunStartedAt)` để lease một phản hồi AI đang chạy. Migration không backfill dữ liệu, không sửa Product/Order/Promotion, và không tạo secret AI trong database.

Theo `DB-AUTH-CHAT-002`, migration file local dev/test được phép tạo nhưng không được apply nếu chưa có phê duyệt riêng. Kiểm thử ghi DB chỉ được chạy với `agentchuan_shop_test`; không dùng `migrate reset` và không reset dữ liệu dev/prod.

### Lỗi ứng dụng sau khi migration và data verification đã đạt

Rollback code về phiên bản tương thích trước đó nhưng giữ nguyên hai bảng additive. Không chạy down migration và không drop bảng audit bằng tay.

### Migration/backfill/data verification thất bại trước khi writer hoạt động lại

Chỉ trong điều kiện này mới thực hiện full development restore:

1. Giữ writer dừng.
2. Xác minh SHA-256 của dump khớp file `.sha256`/manifest.
3. Xác minh target chính xác là `agentchuan_shop`.
4. Drop/recreate duy nhất database đó và restore toàn bộ dump bằng client local; credential qua prompt, không inline.
5. So khớp lại exact order count/status distribution, variant count và tổng stock với manifest.
6. Chỉ mở writer sau khi các số liệu khớp.

Không dùng partial table restore, không chạy down migration thủ công, không restore vào test/production/staging. Nếu verification không khớp sau restore, giữ writer dừng và báo `BLOCKED` cùng dump checksum và metrics sai lệch.
