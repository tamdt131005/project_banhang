# Design System: CHUẨN — tiệm quần áo trực tuyến

Tài liệu này là **nguồn sự thật duy nhất** cho mọi component React trong `frontend/`. Sửa thiết kế thì sửa ở đây trước, rồi mới sửa code.

Token màu và font được khai báo một lần ở `frontend/src/index.css` dưới dạng biến CSS. Component chỉ dùng tên vai trò (`bg-surface`, `text-ink`, `text-accent`), không bao giờ viết mã hex trực tiếp.

> **Phiên bản 2 — chuyển từ "cửa hàng tổng hợp" sang shop bán quần áo.** Tham khảo trực tiếp: mật độ và cách nêu giá của Shopee; taxonomy và giọng copy của Coolmate (gender → loại đồ, mô tả bằng chất liệu + form dáng); quy chuẩn lưới thời trang (ảnh dọc, khe thoáng, thông tin size để giảm đổi trả). Giống ở thói quen sử dụng, khác ở khẩu vị: nền lặng, một màu nhấn, không gradient cam phủ trang.
>
> **Phiên bản 2.1 — lớp hoàn thiện "premium" theo mẫu khách chọn:** tiêu đề lớn dùng serif `Playfair Display`, nút chuyển hết sang dạng pill (bo tròn hẳn), ô nhập kiểu "filled bottom-line" (nền chìm, chỉ viền dưới), nav header CHỮ HOA giãn chữ, footer nhiều cột, trang đăng nhập/đăng ký chia đôi màn hình với ảnh tràn mép. Mua bán theo **biến thể size × màu** — tồn kho nằm trên từng biến thể.
>
> **Phiên bản 2.3 — góc vuông kiểu sàn TMĐT (khách chọn, thay pill của v2.1):** token bán kính hạ về `--radius-card: 0.25rem` và `--radius-control: 0.25rem`. Mọi nút, chip, ô nhập, stepper, phân trang dùng `rounded-control` (4px) — KHÔNG pill. `rounded-full` chỉ còn cho: avatar, nút icon tròn (giỏ, theme, đóng dialog), badge nhỏ (trạng thái đơn, "Mặc định", số trên giỏ) và vòng tròn icon minh hoạ (lối tắt trang chủ, timeline, EmptyState). Icon SVG nét mảnh phủ khắp trang; menu/flyout dùng hàng phủ kín mép panel, không bo lồng trong bo. Thẻ sản phẩm KHÔNG có lớp phủ hover "Xem chi tiết".

---

## 0. Thương hiệu và giọng nói

| | |
|---|---|
| **Tên hiệu** | `CHUẨN` — viết hoa toàn bộ, đậm 700, giãn chữ `-0.02em`, kèm dấu chấm màu nhấn: **CHUẨN.** |
| **Tagline** | "Đồ cơ bản, đúng dáng" |
| **Bán gì** | Quần áo nam nữ hằng ngày + phụ kiện. Không phải sàn tổng hợp — mọi copy nói về đồ mặc |

**Giọng copy** (học từ cách Coolmate viết, không sao chép câu chữ):

- Gọi thẳng món đồ bằng chất liệu và form: "Áo thun cotton 100% form regular", không viết "sản phẩm thời trang cao cấp"
- CTA mệnh lệnh ngắn: "Mua ngay", "Xem thêm", "Chọn size"
- Nói size và số đo cụ thể (S–XL, 28–34) ở mô tả — thông tin fit đầy đủ là thứ giảm đổi trả thật sự
- Không hứa hẹn suông: chỉ nêu chính sách có thật trong hệ thống (COD, huỷ đơn khi chờ xác nhận)

---

## 1. Không khí thị giác

Một **tiệm quần áo đông khách nhưng biết bày hàng**: lưới dày để quét mắt so giá như Shopee, song ảnh dọc 4:5 cho quần áo được đứng thẳng dáng, nền lặng gần trắng và đúng một màu nhấn đỏ gạch cho giá tiền + nút hành động. Chuyển động phản hồi tức thì khi chạm, **không có gì tự nhấp nháy khi người dùng ngồi yên**.

| Thang đo | Mức | Diễn giải |
|---|---|---|
| Mật độ | **7/10** | Dày như chợ, nhưng ảnh dọc cần thở hơn đồ điện tử một nấc |
| Biến thiên bố cục | **4/10** | Lưới hàng đều tăm tắp; riêng trang chủ được lệch trục (hero chia đôi không cân) |
| Cường độ chuyển động | **5/10** | Fluid CSS — mọi chuyển động gắn với tương tác |
| Sáng tạo | **5/10** | Quen thuộc thắng độc đáo: người mua cần biết ngay chỗ bấm |

---

## 2. Bảng màu và vai trò

Giữ nguyên bảng màu phiên bản 1 — trung tính kẽm + đỏ gạch. Nó đứng cạnh quần áo rất tốt vì **không tranh màu với ảnh sản phẩm**, vốn là thứ duy nhất được phép sặc sỡ trong trang. Khác biệt với Shopee nằm ở liều lượng: Shopee phủ cam `#EE4D2D` bão hoà ~85% lên header, banner, nút; ở đây Đỏ Gạch `#D9482B` bão hoà 70% chỉ chạm vào giá tiền, nút chính và trạng thái đang chọn.

### Chế độ sáng

| Tên | Mã | Vai trò |
|---|---|---|
| **Nền Giấy** | `#FAFAFA` | Nền trang, phía sau lưới sản phẩm |
| **Mặt Thẻ** | `#FFFFFF` | Nền thẻ sản phẩm, hộp thoại, thanh điều hướng |
| **Nền Chìm** | `#F4F4F5` | Ô nhập liệu, vùng nhấn nhẹ, nền ảnh đang tải |
| **Mực Đậm** | `#18181B` | Chữ chính, tiêu đề. Không dùng đen tuyệt đối |
| **Mực Nhạt** | `#71717A` | Mô tả, siêu dữ liệu, nhãn phụ |
| **Viền Mảnh** | `#E4E4E7` | Viền thẻ 1px, đường kẻ chia |
| **Đỏ Gạch** | `#D9482B` | **Màu nhấn duy nhất** — giá tiền, nút chính, tab đang chọn, vòng focus, dấu chấm logo |
| **Đỏ Gạch Chìm** | `#FDF0EC` | Nền nhạt của trạng thái đang chọn, nền chip danh mục active |

### Chế độ tối

| Tên | Mã | Vai trò |
|---|---|---|
| **Nền Đêm** | `#09090B` | Nền trang |
| **Mặt Thẻ Tối** | `#18181B` | Nền thẻ, hộp thoại |
| **Nền Chìm Tối** | `#27272A` | Ô nhập liệu, vùng nhấn nhẹ |
| **Mực Sáng** | `#FAFAFA` | Chữ chính |
| **Mực Nhạt Tối** | `#A1A1AA` | Chữ phụ |
| **Viền Tối** | `#27272A` | Viền và đường kẻ |
| **Đỏ Gạch Sáng** | `#F26B4D` | Màu nhấn — sáng hơn bản ngày để đủ tương phản trên nền đen |

### Màu trạng thái đơn hàng

Màu chức năng, không phải màu thương hiệu — trạng thái đơn cần phân biệt bằng màu vì đó là thông tin.

| Trạng thái | Chữ | Nền |
|---|---|---|
| Chờ xác nhận | `#B45309` | `#FEF3C7` |
| Đã xác nhận | `#0369A1` | `#E0F2FE` |
| Đang giao | `#7C2D12` | `#FFEDD5` |
| Đã giao | `#15803D` | `#DCFCE7` |
| Đã huỷ | `#B91C1C` | `#FEE2E2` |

---

## 3. Quy tắc chữ

| Vai trò | Font | Đặc tả |
|---|---|---|
| **Display premium** | `Playfair Display` | 400 / 700 + nghiêng. **Chỉ cho tiêu đề lớn**: hero trang chủ, heading trang đăng nhập/đăng ký, câu dẫn trên ảnh. Cấm dùng cho chữ thân và bảng biểu |
| **Tiêu đề & thân** | `Be Vietnam Pro` | 400 / 500 / 600 / 700. Tiêu đề lớn `letter-spacing: -0.01em` |
| **Nhãn khối kiểu tạp hoá thời trang** | `Be Vietnam Pro` | **VIẾT HOA, 600, cỡ 0.8125rem, giãn chữ `+0.08em`, màu Mực Đậm** — dùng cho tiêu đề khối ("HÀNG MỚI VỀ", "GỢI Ý HÔM NAY") và nav header |
| **Mã & số kỹ thuật** | `JetBrains Mono` | Chỉ cho mã đơn hàng (`DH20260726-00001`) |

**Vì sao là `Be Vietnam Pro`:** các font "có cá tính" mà quy chuẩn taste-design gợi ý (`Geist`, `Satoshi`, `Cabinet Grotesk`) **không có bộ dấu tiếng Việt đầy đủ** — "ệ", "ữ", "ợ" sẽ vỡ hoặc rơi về font hệ thống. `Be Vietnam Pro` sinh ra cho tiếng Việt, có cá tính rõ, và không phải `Inter`. Đây là ngoại lệ có chủ đích so với mặc định của skill.

**Vì sao serif được phép (v2.1):** taste-design cấm serif trong dashboard nhưng cho phép serif đặc sắc ở ngữ cảnh editorial/premium. Khách chọn hướng "high-end fashion", và `Playfair Display` có subset tiếng Việt đầy đủ trên Google Fonts. Giới hạn cứng: chỉ display — thấy serif trong bảng admin hay chữ thân là sai thiết kế.

Nhãn khối viết hoa giãn chữ là chữ ký thị giác của bản thời trang — thay cho tiêu đề thường cỡ 20px của bản 1.

**Giá tiền** dùng `tabular-nums` trên Be Vietnam Pro, không dùng mono: chữ số thẳng cột để so giá theo hàng dọc mà không mang vẻ kỹ thuật.

### Thang cỡ chữ

| Cấp | Cỡ | Trọng lượng | Dùng cho |
|---|---|---|---|
| Display | `clamp(1.75rem, 4vw, 2.5rem)` | 700 | Tiêu đề hero trang chủ |
| H1 | `1.5rem` | 600 | Tên sản phẩm ở trang chi tiết |
| Nhãn khối | `0.8125rem` | 600, HOA, `+0.08em` | Tiêu đề mọi khối nội dung |
| Body | `0.875rem` | 400 | Chữ chung, tên sản phẩm trong lưới |
| Caption | `0.75rem` | 400 | Tồn kho, siêu dữ liệu |
| Giá lớn | `1.5rem` | 700 | Giá trang chi tiết, màu Đỏ Gạch |
| Giá lưới | `1rem` | 600 | Giá trong thẻ, màu Đỏ Gạch |

Chữ thân tối thiểu `14px`, dòng cao `1.5`, đoạn dài giới hạn `65ch`.

---

## 4. Đặc tả component

### Thẻ sản phẩm — component quan trọng nhất

Nền `Mặt Thẻ`, viền `1px` `Viền Mảnh`, bo `0.5rem`, không đổ bóng khi nghỉ.

- **Ảnh DỌC tỉ lệ 4:5** (`aspect-[4/5]`), `object-fit: cover` — quần áo chụp người đứng, khung dọc mới cho thấy dáng. Đây là khác biệt lớn nhất so với bản 1 (ảnh vuông của đồ gia dụng)
- **Hover ảnh phóng nhẹ `scale(1.05)` trong `240ms`** bên trong khung bị cắt (`overflow-hidden`) — ngôn ngữ quen thuộc của web thời trang, chỉ dùng `transform` nên không tính lại bố cục
- Tên 2 dòng, cắt bằng `line-clamp-2`
- Giá `Đỏ Gạch`, 600, `tabular-nums`
- Dòng cuối cỡ Caption màu `Mực Nhạt`: tên danh mục con ("Áo thun nam") — dữ liệu thật từ API
- Ảnh hết hàng: dải "Hết hàng" đè mép dưới ảnh, nền đen mờ 60%
- **Hover thẻ**: nâng `translateY(-2px)` + bóng `0 4px 12px rgb(0 0 0 / 0.08)`, `160ms`; **Active**: về `translateY(0)` tức thì
- **Không có badge giảm giá, không sao đánh giá, không "đã bán N nghìn"** — hệ thống chưa có các dữ liệu đó, và bảng cấm không cho bịa

> Quy chuẩn taste-design khuyên bố cục dày thì bỏ thẻ. Lưới hàng hoá đi ngược: mỗi món cần một khối riêng gói ảnh–tên–giá để mắt bắt ranh giới khi so sánh. Giữ thẻ, hạ độ nổi xuống mức thấp nhất còn đọc được — ngoại lệ có chủ đích thứ hai.

### Nút bấm

- **Góc vuông `rounded-control` (4px)** cho mọi nút — kiểu sàn TMĐT, thay dạng pill của v2.1 (v2.3)
- **Chính**: nền `Đỏ Gạch`, chữ trắng, đệm `0.625rem 1.25rem`, 600
- **Phụ**: trong suốt, viền `1px` `Viền Mảnh`, chữ `Mực Đậm`
- **Chữ**: không nền không viền, chữ `Đỏ Gạch`
- **Active**: `translateY(1px)`. Không quầng sáng, không bóng màu, không con trỏ tuỳ biến
- Vùng chạm tối thiểu `44px` trên di động

### Chip danh mục (mới ở bản 2)

Hàng chip cuộn ngang ở trang chủ và đầu trang danh sách:

- Nghỉ: nền `Mặt Thẻ`, viền `Viền Mảnh`, góc vuông `rounded-control` (4px, v2.3), đệm `0.375rem 0.875rem`, cỡ Body
- Đang chọn: nền `Đỏ Gạch Chìm`, chữ + viền `Đỏ Gạch`
- Cuộn ngang bằng `overflow-x: auto` trong hộp riêng, không tràn trang; ẩn thanh cuộn

### Ô nhập liệu — kiểu "filled bottom-line" (v2.1)

Nhãn **trên** ô, chữ lỗi **dưới**. Không nhãn nổi.

- Nền `Nền Chìm`, **không viền quanh — chỉ viền dưới `1px` `Viền Mảnh`**, bo nhẹ hai góc trên
- **Focus**: viền dưới đổi sang `Đỏ Gạch` và dày lên nhờ `box-shadow 0 1px 0` cùng màu — không đổi border-width để bố cục không nhích 1px
- **Lỗi**: viền dưới và chữ `#B91C1C`, kèm `aria-describedby`
- Ô tìm kiếm trên header là ngoại lệ có viền quanh, góc vuông `rounded-control` cho khớp ngôn ngữ nút (v2.3)

### Bộ chọn size / màu (trang chi tiết)

Chip vuông (4px) như chip danh mục: nghỉ viền `Viền Mảnh`; đang chọn nền `Đỏ Gạch Chìm` + chữ và viền `Đỏ Gạch`; **hết hàng thì mờ 50% + gạch ngang chữ, vẫn hiện để khách biết size đó có tồn tại**. Chọn màu trước, size sau; đổi màu thì tự nhảy về size còn hàng đầu tiên của màu đó. Tồn kho hiện theo đúng biến thể đang chọn.

### Header (v2.1)

Cao `4rem`, dính đỉnh, nền đục. Trái → phải: logo CHUẨN. (đậm 700, giãn `-0.03em`, dấu chấm màu nhấn) · nav CHỮ HOA cỡ `0.75rem` giãn `+0.12em` màu `Mực Nhạt` (ẩn dưới `lg`) — toàn bộ là link thật: Hàng mới, Đồ nam (▾ flyout con), Đồ nữ (▾), Phụ kiện (▾) · ô tìm kiếm vuông có icon kính lúp · icon giỏ SVG kèm badge số · avatar menu (đã đăng nhập) hoặc Đăng nhập (chữ) + Đăng ký (nút vuông nhấn) · nút icon đổi giao diện. Di động: tìm kiếm rơi xuống hàng riêng.

### Footer (v2.1)

Nhiều cột trên nền `Mặt Thẻ`: cột thương hiệu (logo + một đoạn mô tả thật) + các cột link với tiêu đề CHỮ HOA ("MUA SẮM", "TÀI KHOẢN") — **chỉ chứa đường dẫn có thật trong app**, không link chết kiểu "Shipping & Returns". Dòng bản quyền tách riêng bằng đường kẻ.

### Trang đăng nhập / đăng ký (v2.1)

Chia đôi màn hình từ `lg`: trái là form trong khung `420px` với heading serif; phải là **ảnh thời trang tràn mép** + gradient tối dần về đáy + câu dẫn serif nghiêng (ngoại lệ có kiểm soát của luật "không chồng lấn": chữ nằm trên vùng gradient dành riêng cho nó). Dưới `lg` chỉ còn form, không tải ảnh thừa. Không nút đăng nhập mạng xã hội (chưa có OAuth), không "Quên mật khẩu" (chưa có tính năng) — nút không bấm được thì không vẽ.

### Badge trạng thái đơn

Cặp màu mục 2, bo tròn hẳn, đệm `0.125rem 0.5rem`.

### Trạng thái tải và rỗng

- **Đang tải**: skeleton đúng kích thước nội dung thật (thẻ skeleton cũng 4:5), nhấp nháy độ mờ. Không vòng xoay tròn.
- **Rỗng**: một câu chỉ bước tiếp theo ("Giỏ hàng đang trống — xem hàng mới về") + một nút chính.
- **Lỗi**: thông báo nội tuyến tại chỗ, kèm nút thử lại.

---

## 5. Nguyên tắc bố cục

- Khung chứa tối đa `1280px`, căn giữa, đệm ngang `1rem` → `1.5rem`
- Thang khoảng cách bội số 4: `4 8 12 16 24 32 48 64`
- CSS Grid, không `calc()` phần trăm; không phần tử chồng lấn
- Phần cao toàn màn dùng `min-h-[100dvh]`, cấm `h-screen`

### Lưới sản phẩm (đổi theo ảnh dọc)

Ảnh 4:5 làm thẻ cao lên ~30%, nên bớt một cột ở mỗi mốc so với bản 1 — 6 cột ảnh dọc sẽ thành tem thư:

| Bề rộng | Số cột |
|---|---|
| `< 640px` | 2 |
| `640–1024px` | 3 |
| `1024–1280px` | 4 |
| `> 1280px` | 5 |

Khe `0.75rem` di động, `1rem` máy tính. Lưới đều tăm tắp — người mua so giá theo hàng cột (ngoại lệ có chủ đích thứ ba so với lệnh cấm "lưới card đều" của skill, vốn nhắm vào hàng tính năng marketing).

### Cấu trúc trang chủ (v2.2 — lookbook theo chuẩn Routine/YODY/IVY moda + cổng đối tượng theo Canifa/H&M)

Từ trên xuống — mọi khối bấm được đều dẫn tới bộ lọc thật:

1. **Lookbook hero khổ lớn**: một mảng ảnh cao `340px` (di động) → `420px`, chữ nằm trong dải gradient tối bên trái (heading serif + tagline + đúng một CTA "Mua ngay"). Đây là "điểm dừng thị giác" — cả trang chỉ có một mảng như vậy. Không băng chuyền tự chạy.
2. **Dải lối tắt** (v2.3): 5 vòng tròn icon màu nhạt — Hàng mới về / Đồ nam / Đồ nữ / Phụ kiện / Đơn mua — nhấc `-4px` khi hover, mọi ô là link thật.
3. **Ba cổng đối tượng** `Đồ nam / Đồ nữ / Phụ kiện`: ảnh dọc + nhãn CHỮ HOA trên gradient đáy, ảnh phóng nhẹ khi hover. Link theo categoryId thật.
4. **Hàng chip danh mục** cuộn ngang — toàn bộ danh mục con, bấm là lọc.
5. **HÀNG MỚI VỀ** — 10 sản phẩm `sort=newest`, kèm link "Xem tất cả".
6. **GỢI Ý HÔM NAY** (v2.3) — tiêu đề giữa gạch chân màu nhấn, 12 món `sort=price-asc` + nút "Xem thêm sản phẩm". (Khu "Đồ dưới 200K" đã bỏ theo yêu cầu khách.)

> Chữ trên ảnh ở khối 1 và 2 là ngoại lệ có kiểm soát của luật "không chồng lấn": chữ chỉ nằm trong dải gradient dành riêng cho nó, không bao giờ đè lên chữ hay nút khác.

### Đáp ứng màn hình

- Dưới `768px`: mọi bố cục nhiều cột (trừ lưới sản phẩm) về một cột
- Không bao giờ tràn ngang; bảng và hàng chip tự cuộn trong hộp riêng `overflow-x: auto`
- Logo đầu trang bắt buộc là link về trang chủ

---

## 6. Chuyển động và tương tác

| Loại | Thời lượng | Hàm nhịp |
|---|---|---|
| Vi tương tác (hover, active) | `160ms` | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Phóng ảnh trong thẻ | `240ms` | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Xuất hiện (hộp thoại, ngăn kéo) | `320ms` | `cubic-bezier(0.16, 1, 0.3, 1)` |

Không dùng `linear` cho bất cứ thứ gì nhìn thấy được.

**Vòng lặp vô hạn: chỉ duy nhất skeleton đang tải.** Bản 1 còn cho phép băng chuyền banner và badge flash-sale tự chạy; bản 2 cắt nốt — hero giờ là ảnh tĩnh, và không có khu flash-sale nào cả. Một trang đứng yên thì không được có gì tự động cử động. Đây là cách "chuyển động mượt, tránh lag" được thực thi triệt để nhất.

---

## 7. Bảy quy tắc chống lag

1. **Chỉ animate `transform` và `opacity`** — không bao giờ `top/left/width/height/margin`.
2. **`content-visibility: auto` + `contain-intrinsic-size: 420px`** trên thẻ sản phẩm (420 thay 320 vì thẻ 4:5 cao hơn).
3. **Lưới luôn dùng thumbnail 400×500** do backend sinh, kèm `loading="lazy"` + `decoding="async"` dưới màn hình đầu. Không bao giờ tải ảnh gốc vào lưới.
4. **Tôn trọng `prefers-reduced-motion: reduce`** — tắt toàn bộ, kể cả skeleton.
5. **Không `backdrop-filter` trong vùng cuộn** — thanh điều hướng dính dùng nền đục.
6. **`will-change` chỉ đặt lúc tương tác rồi gỡ**, không thường trực.
7. **Danh sách dài phân trang phía server**, không cuộn vô hạn.

---

## 8. Những thứ bị cấm

- Không emoji trong giao diện
- Không font `Inter`, không serif chung chung
- Không đen tuyệt đối `#000000` — dùng `#18181B` / `#09090B`
- Không quầng neon, bóng màu, gradient chữ, con trỏ tuỳ biến
- Không phần tử chồng lấn
- **Không số liệu bịa**: "99% khách hài lòng", "50.000+ đơn/ngày" — không có số thật thì không viết
- **Không badge giảm giá bịa, không sao đánh giá bịa, không "đã bán N" bịa** — schema chưa có các trường này thì giao diện không được vẽ ra
- Không khu "flash sale" dàn dựng có đồng hồ đếm ngược giả
- Không tên giả chung chung ("Nguyễn Văn A", "Acme")
- Không sáo ngữ: "Nâng tầm phong cách", "Đột phá", "Trải nghiệm liền mạch"
- Không chữ độn: "Cuộn xuống để khám phá", mũi tên nhấp nhô
- Không link ảnh hỏng — ảnh mẫu dùng `picsum.photos`
- Không định dạng `NHÃN // NĂM`

---

## 9. Danh sách màn hình

**Cửa hàng (9):** trang chủ, danh sách sản phẩm, chi tiết sản phẩm, giỏ hàng, thanh toán, đặt hàng thành công, đơn của tôi, chi tiết đơn, sổ địa chỉ

**Tài khoản (2):** đăng nhập, đăng ký

**Quản trị (5):** danh sách sản phẩm, thêm/sửa sản phẩm, danh mục, danh sách đơn, chi tiết đơn

Trang quản trị giữ mật độ bảng biểu của bản 1 — admin là dashboard, không cần chất thời trang, chỉ ăn chung token màu.

## 10. Quy ước code

- Mỗi UI pattern lặp lại là **một component riêng** trong `src/components/`, khai báo `interface Readonly<[Tên]Props>` kể cả khi chưa có prop.
- Logic tương tác tách vào hook trong `src/hooks/`.
- **Chỉ dùng token vai trò** — không hex trong component; đổi màu sửa đúng một chỗ (`index.css`).
- Chế độ tối đổi giá trị biến CSS dưới `.dark`; chỉ dùng `dark:` cho màu ngoài bộ token (badge trạng thái đơn).
- Danh mục seed theo taxonomy **giới → loại đồ** (Đồ nam / Đồ nữ / Phụ kiện → Áo thun nam, Váy đầm...); sản phẩm luôn gắn vào danh mục con.
