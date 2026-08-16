import { Link } from 'react-router-dom';
import { formatVnd } from '../../lib/format';
import type { ApiProductSummary } from '../../types/api';

export interface ProductCardProps {
  product: ApiProductSummary;
  home?: boolean;
}

export function ProductCard({ product, home = false }: Readonly<ProductCardProps>) {
  const thumb = product.images[0]?.thumbUrl;
  const soldOut = product.stock <= 0;

  return (
    <Link
      to={`/san-pham/${product.slug}`}
      /*
       * card-defer = content-visibility:auto — trình duyệt bỏ qua việc dựng
       * thẻ nằm ngoài màn hình (quy tắc chống lag số 2).
       * Chỉ animate transform và box-shadow, không đụng vào width/height.
       */
      className="card-defer group block overflow-hidden rounded-card border border-line bg-surface transition-[transform,box-shadow] duration-[160ms] ease-snap hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgb(0_0_0/0.08)] active:translate-y-0"
    >
      {/* Khung DỌC 4:5 — quần áo chụp người đứng cần khung đứng (DESIGN.md mục 4). */}
      <div className="relative aspect-[4/5] overflow-hidden bg-sunken">
        {thumb ? (
          <img
            src={thumb}
            alt={product.name}
            /* Lưới luôn dùng bản thumbnail 400×500, không bao giờ tải ảnh gốc. */
            loading="lazy"
            decoding="async"
            /* Phóng nhẹ khi hover — ngôn ngữ quen của web thời trang, chỉ dùng
               transform nên không tính lại bố cục. */
            className="size-full object-cover transition-transform duration-[240ms] ease-snap group-hover:scale-105"
          />
        ) : null}

        {/* Còn ≤5 món là dữ liệu tồn kho thật — không phải nhãn giục mua bịa ra. */}
        {!soldOut && product.stock <= 5 ? (
          <span className="absolute top-2 left-2 rounded-control bg-accent px-2 py-0.5 text-[0.625rem] font-bold text-accent-ink">
            Sắp hết
          </span>
        ) : null}

        {soldOut ? (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-xs font-medium text-white">
            Hết hàng
          </span>
        ) : null}
      </div>

      <div className="p-2.5">
        <h3 className="line-clamp-2 min-h-[2.6em] text-sm leading-[1.3] group-hover:text-accent">
          {product.name}
        </h3>
        <p className="tabular mt-1.5 font-semibold text-accent">{formatVnd(product.price)}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{product.category.name}</p>
      </div>
    </Link>
  );
}
