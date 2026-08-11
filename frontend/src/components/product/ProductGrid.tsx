import type { ApiProductSummary } from '../../types/api';
import { Skeleton } from '../ui/Feedback';
import { ProductCard } from './ProductCard';

export interface ProductGridProps {
  products: ApiProductSummary[];
  loading?: boolean;
  skeletonCount?: number;
}

/**
 * 2 cột di động → 5 cột màn rộng, theo bảng ở mục 5 của DESIGN.md.
 * Bớt một cột so với bản thẻ vuông: ảnh dọc 4:5 mà chia 6 cột sẽ thành tem thư.
 */
const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4';

export function ProductGrid({
  products,
  loading = false,
  skeletonCount = 12,
}: Readonly<ProductGridProps>) {
  if (loading) {
    return (
      <div className={GRID}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-card border border-line bg-surface">
            {/* Skeleton đúng tỉ lệ 4:5 của ảnh thật để lưới không nhảy khi tải xong. */}
            <Skeleton className="aspect-[4/5] rounded-none" />
            <div className="space-y-2 p-2.5">
              <Skeleton className="h-3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={GRID}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
