# TÂM ĐẶNG — tiệm quần áo trực tuyến

Shop bán quần áo chạy trên máy: khách xem đồ nam/nữ và phụ kiện, đăng ký/đăng nhập, bỏ giỏ, đặt hàng COD; admin quản lý sản phẩm, danh mục và đơn hàng. Hệ thống thiết kế (bảng màu, thẻ ảnh dọc 4:5, quy tắc chống lag) nằm trong `DESIGN.md`.

| | |
|---|---|
| **backend/** | Node.js + Express 5 + TypeScript + Prisma 7 → MySQL 8.4 |
| **frontend/** | React 19 + Vite + TypeScript + Tailwind 4 |

## Yêu cầu

- Node.js 20 trở lên (`node -v`)
- Laragon đang chạy, dịch vụ MySQL đã bật

> Laragon đóng gói **MySQL 8.4**, không phải MariaDB. Prisma dùng chung provider
> `mysql` cho cả hai nên không ảnh hưởng gì tới code.

## Cài đặt

### 1. Tạo database

Mở Laragon → **Menu** → **MySQL** → **CLI**, rồi chạy:

```sql
CREATE DATABASE agentchuan_shop      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE agentchuan_shop_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> `utf8mb4` là bắt buộc — bảng mã cũ `utf8` của MySQL/MariaDB chỉ chứa 3 byte nên làm hỏng emoji và một số ký tự tiếng Việt tổ hợp.

### 2. Cấu hình biến môi trường

```powershell
copy backend\.env.example backend\.env
```

Mở `backend\.env` và sửa `DATABASE_URL` nếu Laragon của bạn dùng mật khẩu khác mặc định. Mặc định của Laragon là user `root`, mật khẩu rỗng:

```
DATABASE_URL="mysql://root:@localhost:3306/agentchuan_shop"
```

### 3. Cài thư viện

```powershell
npm install          # cho package.json gốc
npm run setup        # cài cho cả backend và frontend
```

### 4. Tạo bảng và dữ liệu mẫu

```powershell
cd backend
npx prisma migrate dev
npm run seed
cd ..
```

## Chạy

```powershell
npm run dev
```

| Địa chỉ | Nội dung |
|---|---|
| http://localhost:5173 | Trang chủ cửa hàng |
| http://localhost:5173/san-pham | Danh sách sản phẩm, có lọc và tìm kiếm |
| http://localhost:5173/don-hang | Đơn hàng của tôi |
| http://localhost:5173/admin/san-pham | Trang quản trị (cần tài khoản admin) |
| http://localhost:4000/api/health | Kiểm tra backend và database còn sống |

Frontend gọi API qua proxy của Vite (`/api` → `localhost:4000`), nên trình duyệt coi hai bên là cùng origin và cookie đăng nhập hoạt động ngay.

### Tài khoản có sẵn trong dữ liệu mẫu

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin@shop.test` | `Admin@12345` |
| Khách hàng | `khach@shop.test` | `Khach@12345` |

## Các lệnh khác

```powershell
npm run build        # build cả hai
npm run typecheck    # kiểm tra kiểu TypeScript cả hai
npm test             # test backend (Vitest + Supertest)

cd backend
npx prisma studio    # xem/sửa dữ liệu bằng giao diện
npx prisma migrate dev --name <tên>   # tạo migration mới sau khi đổi schema

cd frontend
npm run validate:components   # validator AST của skill Stitch react-components
```

`validate:components` kiểm tra mọi file `.tsx`: phải khai báo `interface ...Props` và không được viết mã màu hex trong `className`. Nó cần plugin Stitch:

```powershell
npx plugins add google-labs-code/stitch-skills --scope project --target claude-code
```

Bộ test dùng database riêng `agentchuan_shop_test` và **xoá sạch dữ liệu trong đó trước mỗi test**. Có hai chốt chặn từ chối chạy nếu tên database không chứa `_test`, nên không thể lỡ tay trỏ vào dữ liệu thật.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `P1001: Can't reach database server` | MySQL trong Laragon chưa bật, hoặc cổng khác `3306` |
| `P1000: Authentication failed` | Sai user/mật khẩu trong `DATABASE_URL` |
| `P1003: Database does not exist` | Chưa chạy bước 1 tạo database |
| Đăng nhập xong lại bị đăng xuất | Gọi API thẳng vào `localhost:4000` thay vì qua proxy `5173` — cookie sẽ không được gửi |
| Bị `429 RATE_LIMITED` khi test | Đúng như thiết kế. Xem ngưỡng trong `backend/src/middleware/rateLimit.ts` |

## Tài liệu liên quan

- `DESIGN.md` — hệ thống thiết kế: bảng màu, thang chữ, đặc tả component, quy tắc chống lag

# project_ca_nhan
