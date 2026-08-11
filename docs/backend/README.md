# Backend contract — SPEC-BE-001 v0.3

Tài liệu này mô tả contract backend đã chốt cho tính toàn vẹn trạng thái đơn hàng và tồn kho. OpenAPI máy đọc được nằm tại [openapi.yaml](./openapi.yaml); quy trình dữ liệu nằm tại [database.md](./database.md).

## Nguyên tắc thực thi

- Controller chỉ xác thực request và truyền `req.user.id`; quy tắc nghiệp vụ nằm trong service.
- Mọi ghi `ProductVariant.stock` của luồng nghiệp vụ đi qua `modules/inventory/inventory.service.ts`.
- Tạo/giữ/hoàn/điều chỉnh/ngừng biến thể và ledger tương ứng nằm trong cùng Prisma transaction.
- Mọi đổi trạng thái đơn đi qua một transition seam. Backend claim bằng `UPDATE ... WHERE id = ? AND status = expected` trước mọi side effect.
- `order_status_history` và `inventory_movements` là append-only: không có API update/delete.
- `operationKey` là duy nhất, ổn định cho các sự kiện có thể retry.

Seed và test fixture là ngoại lệ hạ tầng: chúng được phép ghi tồn trực tiếp để dựng trạng thái kiểm thử, không phải đường ghi nghiệp vụ và không đại diện cho contract production.

## Ma trận trạng thái đơn

| Actor | Từ | Sang |
|---|---|---|
| CUSTOMER | `PENDING` | `CANCELLED` |
| ADMIN | `PENDING` | `CONFIRMED`, `CANCELLED` |
| ADMIN | `CONFIRMED` | `SHIPPING`, `CANCELLED` |
| ADMIN | `SHIPPING` | `DELIVERED` |

`DELIVERED` và `CANCELLED` là terminal. Đặc biệt, `SHIPPING -> CANCELLED` bị chặn.

Huỷ lại đơn đã `CANCELLED` trả `200` với `replayed: true`; không ghi thêm history, không hoàn kho và không ghi movement lần hai. Same-state khác vẫn trả `409 ORDER_STATUS_UNCHANGED`.

### Order detail và timeline

`GET /api/orders/{code}` và `GET /api/admin/orders/{code}` trả thêm `order.statusHistory`, tăng dần theo `recordedAt`, sau đó `id`:

```json
{
  "id": 12,
  "type": "TRANSITION",
  "fromStatus": "PENDING",
  "toStatus": "CANCELLED",
  "actorType": "CUSTOMER",
  "actorUserId": 7,
  "reason": null,
  "occurredAt": "2026-08-07T12:00:00.000Z",
  "recordedAt": "2026-08-07T12:00:00.000Z"
}
```

Đơn mới có một record `CREATED`, `null -> PENDING`. Đơn có trước migration có một record `BASELINE`, `occurredAt: null`; backend không suy diễn thời điểm lịch sử từ `orders.updatedAt`.

## Inventory ledger

Các loại movement cố định:

| Type | Ý nghĩa |
|---|---|
| `BASELINE` | Ảnh chụp tồn tại lúc migration; `beforeStock` và `delta` là `null` |
| `INITIAL_STOCK` | Tồn ban đầu của biến thể mới |
| `ORDER_RESERVED` | Trừ tồn khi tạo đơn |
| `ORDER_RESTORED` | Hoàn tồn khi huỷ đơn |
| `ADMIN_ADJUSTMENT` | Điều chỉnh có reason và compare-and-set |
| `VARIANT_RETIRED` | Ghi nhận trước khi hard delete biến thể tồn bằng 0 |

Movement thường thỏa `afterStock = beforeStock + delta`. Snapshot tên sản phẩm/size/màu giúp record vẫn đọc được sau khi reference nullable bị xoá.

### Điều chỉnh tồn kho

`PATCH /api/admin/inventory/{variantId}`:

```json
{
  "stock": 42,
  "expectedStock": 4,
  "reason": "Nhập thêm sau kiểm kê"
}
```

Thành công trả `{ "variant": ..., "movement": ... }`. Nếu tồn hiện tại khác `expectedStock`, API trả:

```json
{
  "error": {
    "code": "STOCK_CHANGED",
    "message": "...",
    "details": { "currentStock": 5 }
  }
}
```

Frontend phải nạp lại row rồi yêu cầu người vận hành xác nhận lại; không tự retry bằng giá trị mới.

`GET /api/admin/inventory/{variantId}/movements?page=1&limit=20` trả `{ items, pagination }`, mới nhất trước.

## Contract biến thể sản phẩm

Tạo sản phẩm:

```json
{ "variants": [{ "size": "M", "color": "Đen", "initialStock": 10 }] }
```

Cập nhật sản phẩm dùng danh sách thay thế với union:

```json
{
  "variants": [
    { "id": 31, "size": "M", "color": "Đen" },
    { "size": "L", "color": "Trắng", "initialStock": 5 }
  ]
}
```

- Biến thể hiện có bắt buộc dùng `id` ổn định; không nhận `stock` hoặc `initialStock`.
- Biến thể mới không có `id`, nhận `initialStock`.
- Bỏ một biến thể khỏi danh sách update là yêu cầu retire/hard delete.
- Hard delete biến thể hoặc sản phẩm có bất kỳ tồn `> 0` trả `409 STOCK_REMAINS`. Có thể dùng `isActive: false` để ngừng bán mà không xoá.
- Điều chỉnh stock của biến thể hiện có chỉ dùng inventory endpoint.

## Mã lỗi cần xử lý ở frontend

| HTTP | Code | Hành động |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Hiển thị lỗi theo field |
| 404 | `NOT_FOUND` | Nạp lại danh sách/điều hướng khỏi record đã mất |
| 409 | `STOCK_CHANGED` | Nạp lại stock, yêu cầu xác nhận lại |
| 409 | `STOCK_REMAINS` | Điều chỉnh tồn về 0 hoặc chuyển `isActive=false` |
| 409 | `OUT_OF_STOCK` | Nạp lại giỏ hàng |
| 409 | `INVALID_STATUS_TRANSITION` | Nạp lại đơn và ma trận action |
| 409 | `ORDER_STATUS_CHANGED` | Có writer khác thắng; nạp lại đơn |
| 409 | `ORDER_NOT_CANCELLABLE` | Khách liên hệ cửa hàng |
| 401/403 | `UNAUTHORIZED` / `FORBIDDEN` | Đăng nhập lại hoặc ẩn chức năng admin |

## Kiểm tra cục bộ

Từ `backend/`:

```powershell
npx prisma validate
npx prisma generate
npm run typecheck
npm test
```

`npm test` chỉ được chạy khi `TEST_DATABASE_URL` parse chính xác thành database `agentchuan_shop_test`. Hai guard độc lập dừng trước mọi reset nếu URL sai hoặc malformed.
