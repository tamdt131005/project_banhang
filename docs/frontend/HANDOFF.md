# SPEC-BE-001 v0.3 — Frontend handoff

Trạng thái: implementation contract cho vòng Agile phối hợp backend/frontend. Backend là nơi quyết định chuyển trạng thái, tồn kho và quyền truy cập; frontend chỉ giới hạn thao tác rõ ràng và phản hồi lỗi từ server.

## 1. Order state và audit timeline

Ma trận nút thao tác:

| Actor | Từ | Sang |
|---|---|---|
| CUSTOMER | `PENDING` | `CANCELLED` |
| ADMIN | `PENDING` | `CONFIRMED`, `CANCELLED` |
| ADMIN | `CONFIRMED` | `SHIPPING`, `CANCELLED` |
| ADMIN | `SHIPPING` | `DELIVERED` |

`DELIVERED` và `CANCELLED` là terminal. Không hiển thị `SHIPPING → CANCELLED`.

API chi tiết đơn trả `statusHistory` theo `recordedAt ASC, id ASC`:

```ts
interface OrderStatusHistory {
  id: number;
  type: 'CREATED' | 'TRANSITION' | 'BASELINE';
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  actorUserId: number | null;
  reason: string | null;
  occurredAt: string | null;
  recordedAt: string;
}
```

- Timeline phải render đúng các record này, không dựng mốc trung gian từ trạng thái hiện tại.
- `BASELINE` có `occurredAt=null`: hiển thị “dữ liệu chuyển đổi — không rõ thời điểm xảy ra” và chỉ dùng `recordedAt` làm thời điểm ghi nhận.
- Chỉ fallback về thanh trạng thái hiện tại nếu payload không có lịch sử hoặc lịch sử rỗng.
- Huỷ lặp hợp lệ có thể trả `{ order, replayed: true }`; xử lý như success, không hiện lỗi.

Sau đổi trạng thái, invalidate chi tiết/danh sách đơn. Nếu huỷ, invalidate thêm inventory, catalog product và dashboard stats vì backend có thể hoàn kho.

## 2. Inventory adjustment và movement history

Điều chỉnh tồn kho:

```http
PATCH /api/admin/inventory/:variantId
Content-Type: application/json

{
  "stock": 12,
  "expectedStock": 10,
  "reason": "Nhập bổ sung theo phiếu NK-2408"
}
```

- `expectedStock` lấy từ đúng row vừa tải; không tự thay bằng giá trị mới.
- `reason` bắt buộc, trim phía client, backend tiếp tục validate.
- Khi thành công, invalidate inventory list, movement history của variant, admin stats và product catalog.
- `409 STOCK_CHANGED`: báo rõ tồn đã đổi ở phiên khác, refetch inventory, buộc nhân viên kiểm tra số dư mới trước khi gửi lại.

Lịch sử biến động:

```http
GET /api/admin/inventory/:variantId/movements?page=1&limit=10
```

Response dùng `ApiPaged<InventoryMovement>`. Các type được hiển thị:

- `BASELINE`
- `INITIAL_STOCK`
- `ORDER_RESERVED`
- `ORDER_RESTORED`
- `ADMIN_ADJUSTMENT`
- `VARIANT_RETIRED`

`beforeStock`/`delta` của baseline có thể null. Không biến null thành 0 vì sẽ tạo lịch sử sai nghĩa.

## 3. Product/variant contract

Biến thể mới khi tạo product hoặc thêm trong form update:

```json
{ "size": "M", "color": "Đen", "initialStock": 5 }
```

Biến thể đã tồn tại khi update product:

```json
{ "id": 123, "size": "M", "color": "Đen" }
```

Quy tắc frontend:

- Luôn giữ và gửi `id` của biến thể đã tồn tại.
- Không gửi `stock` hoặc `initialStock` cho biến thể đã tồn tại.
- Hiển thị tồn hiện tại dạng read-only và dẫn nhân viên sang `/admin/kho` để điều chỉnh có audit.
- Không cho xoá trên UI khi tồn lớn hơn 0. Backend vẫn là authority và trả `409 STOCK_REMAINS` nếu dữ liệu đã đổi hoặc request khác cố xoá.
- Biến thể mới dùng `initialStock`; không dùng trường `stock` cũ.

## 4. Error/loading/permission behavior

| Tình huống | UI bắt buộc |
|---|---|
| Loading | Skeleton theo layout hiện tại |
| API detail/list lỗi, gồm 401/403/404 | Alert từ error envelope và đường quay lại phù hợp |
| Danh sách/movement rỗng | Empty/no-data message, không dựng dữ liệu mẫu |
| `STOCK_CHANGED` | Thông báo xung đột và refetch số dư |
| `STOCK_REMAINS` | Giữ form, hướng dẫn đưa tồn về 0 trong Kho hàng |
| `INVALID_STATUS_TRANSITION` / trạng thái vừa đổi ở phiên khác | Hiện lỗi backend và refetch chi tiết đơn qua query invalidation khi thao tác tiếp theo thành công |

Route admin vẫn nằm sau guard hiện tại. Không dựa vào ẩn nút để bảo mật; backend phải trả 401/403 cho người không có quyền.

## 5. Acceptance checklist FE

- [ ] Timeline đơn mới hiển thị `CREATED`, sau mỗi chuyển trạng thái có đúng mốc thật.
- [ ] Order baseline ghi rõ thời điểm nghiệp vụ không xác định.
- [ ] Admin không thấy nút huỷ ở `SHIPPING`; khách chỉ thấy huỷ ở `PENDING`.
- [ ] Hai lần nhận cancel success, gồm `replayed:true`, đều cập nhật cache bình thường.
- [ ] Product update gửi variant tồn tại bằng `id` và không có field stock.
- [ ] Variant mới gửi `initialStock`; variant tồn dương không xoá được từ form.
- [ ] Inventory adjustment không gửi khi thiếu reason; request chứa đúng `expectedStock` đã tải.
- [ ] `STOCK_CHANGED` refetch row và không âm thầm ghi đè.
- [ ] Movement baseline hiển thị null đúng nghĩa; paging/loading/error/no-data hoạt động.
- [ ] Frontend typecheck và production build pass cùng backend contract của iteration.

