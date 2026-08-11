import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { catalogApi } from '../../api/catalog';
import { Button } from '../../components/ui/Button';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import { ArrowLeftIcon, BagIcon, BoxIcon, ChevronRightIcon } from '../../components/ui/icons';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { useAuth } from '../../context/AuthContext';
import { useAddToCart } from '../../hooks/useCart';
import { errorMessage } from '../../lib/errors';
import { formatVnd } from '../../lib/format';
import type { ApiVariant } from '../../types/api';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface ProductDetailPageProps {}

/** Chip chọn thuộc tính — dùng cho cả màu lẫn size. */
interface OptionChipProps {
  label: string;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}

function OptionChip({ label, active, disabled, onSelect }: Readonly<OptionChipProps>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`h-9 rounded-control border px-3.5 text-sm transition-colors duration-[160ms] ${
        active
          ? 'border-accent bg-accent-soft font-semibold text-accent'
          : disabled
            ? 'cursor-not-allowed border-line text-ink-muted opacity-50 line-through'
            : 'border-line hover:border-accent hover:text-accent'
      }`}
    >
      {label}
    </button>
  );
}

/** Thứ tự xuất hiện đầu tiên, giữ đúng thứ tự khai báo S→XL từ dữ liệu. */
function uniqueInOrder(values: string[]) {
  return [...new Set(values)];
}

export function ProductDetailPage({}: Readonly<ProductDetailPageProps>) {
  const { slug = '' } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const addToCart = useAddToCart();

  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const productQuery = useQuery({
    queryKey: ['product', slug],
    queryFn: () => catalogApi.product(slug).then((response) => response.product),
    enabled: slug !== '',
  });

  const variants = productQuery.data?.variants ?? [];

  // Chọn sẵn biến thể còn hàng đầu tiên để người mua ít phải bấm nhất;
  // sản phẩm một size một màu nhờ vậy mua được ngay không cần chọn gì.
  useEffect(() => {
    if (variants.length === 0) return;
    const first = variants.find((variant) => variant.stock > 0) ?? variants[0]!;
    setColor(first.color);
    setSize(first.size);
    setQuantity(1);
  }, [productQuery.data?.id]);

  if (productQuery.isPending) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="aspect-[4/5]" />
        <div className="space-y-3">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-9 w-1/3" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (productQuery.isError) {
    return (
      <div className="space-y-4">
        <Alert>{errorMessage(productQuery.error)}</Alert>
        <Link to="/san-pham" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          <ArrowLeftIcon className="size-4" />
          Quay lại danh sách sản phẩm
        </Link>
      </div>
    );
  }

  const product = productQuery.data;
  const image = product.images[activeImage] ?? product.images[0];

  const colors = uniqueInOrder(variants.map((variant) => variant.color));
  const sizesForColor = (colorName: string | null) =>
    uniqueInOrder(
      variants
        .filter((variant) => colorName === null || variant.color === colorName)
        .map((variant) => variant.size),
    );

  const findVariant = (sizeName: string | null, colorName: string | null): ApiVariant | null =>
    variants.find((variant) => variant.size === sizeName && variant.color === colorName) ?? null;

  const selected = findVariant(size, color);
  const soldOutEverywhere = product.stock <= 0;

  /** Màu hết sạch hàng ở mọi size thì vẫn bấm được nhưng gạch chân mờ. */
  const colorHasStock = (colorName: string) =>
    variants.some((variant) => variant.color === colorName && variant.stock > 0);

  function pickColor(next: string) {
    setColor(next);
    setFeedback(null);
    // Size đang chọn có thể không tồn tại hoặc hết hàng ở màu mới —
    // nhảy sang size còn hàng đầu tiên của màu đó.
    const candidate = findVariant(size, next);
    if (!candidate || candidate.stock <= 0) {
      const firstInStock =
        variants.find((variant) => variant.color === next && variant.stock > 0) ??
        variants.find((variant) => variant.color === next);
      setSize(firstInStock?.size ?? null);
    }
    setQuantity(1);
  }

  function pickSize(next: string) {
    setSize(next);
    setFeedback(null);
    setQuantity(1);
  }

  async function handleAddToCart() {
    // Giỏ hàng lưu trên server nên phải đăng nhập trước. Nhớ đường dẫn hiện
    // tại để sau khi đăng nhập quay lại đúng sản phẩm này.
    if (!user) {
      void navigate('/dang-nhap', { state: { from: location.pathname } });
      return;
    }

    if (!selected) return;

    setFeedback(null);
    try {
      await addToCart.mutateAsync({ variantId: selected.id, quantity });
      setFeedback({
        tone: 'success',
        text: `Đã thêm ${product.name} (${selected.size}, ${selected.color}) vào giỏ.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error) });
    }
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-ink-muted">
        <Link to="/san-pham" className="transition-colors duration-[160ms] hover:text-ink">
          Sản phẩm
        </Link>
        <ChevronRightIcon className="size-3" />
        <Link
          to={`/san-pham?categoryId=${product.category.id}`}
          className="transition-colors duration-[160ms] hover:text-ink"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          {/* Khung dọc 4:5 đồng bộ với thẻ lưới — ảnh quần áo chụp dáng đứng. */}
          <div className="aspect-[4/5] overflow-hidden rounded-card border border-line bg-sunken">
            {image ? (
              <img
                src={image.url}
                alt={product.name}
                /* Ảnh chính nằm trong màn hình đầu nên tải ngay, không lazy. */
                decoding="async"
                className="size-full object-cover"
              />
            ) : null}
          </div>

          {product.images.length > 1 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {product.images.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`Xem ảnh ${index + 1}`}
                  className={`size-16 shrink-0 overflow-hidden rounded-control border-2 ${
                    index === activeImage ? 'border-accent' : 'border-line'
                  }`}
                >
                  <img
                    src={item.thumbUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="tabular mt-3 text-2xl font-bold text-accent">{formatVnd(product.price)}</p>

          {/* Chọn màu */}
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-ink-muted">
              Màu sắc{color ? <span className="text-ink">: {color}</span> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {colors.map((colorName) => (
                <OptionChip
                  key={colorName}
                  label={colorName}
                  active={color === colorName}
                  disabled={!colorHasStock(colorName)}
                  onSelect={() => pickColor(colorName)}
                />
              ))}
            </div>
          </div>

          {/* Chọn size — chỉ hiện các size có ở màu đang chọn */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-ink-muted">
              Size{size ? <span className="text-ink">: {size}</span> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {sizesForColor(color).map((sizeName) => {
                const variant = findVariant(sizeName, color);
                return (
                  <OptionChip
                    key={sizeName}
                    label={sizeName}
                    active={size === sizeName}
                    disabled={!variant || variant.stock <= 0}
                    onSelect={() => pickSize(sizeName)}
                  />
                );
              })}
            </div>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-muted">
            <BoxIcon className="size-4" />
            {soldOutEverywhere
              ? 'Sản phẩm tạm hết hàng'
              : selected
                ? selected.stock > 0
                  ? `Còn ${selected.stock} sản phẩm`
                  : 'Hết hàng ở lựa chọn này'
                : 'Chọn màu và size để xem tồn kho'}
          </p>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Số lượng</span>
              <QuantityStepper
                value={quantity}
                max={Math.max(1, Math.min(99, selected?.stock ?? 1))}
                disabled={!selected || selected.stock <= 0}
                label="số lượng"
                onChange={setQuantity}
              />
            </div>

            <Button
              onClick={() => void handleAddToCart()}
              disabled={!selected || selected.stock <= 0}
              loading={addToCart.isPending}
            >
              {soldOutEverywhere || (selected !== null && selected.stock <= 0) ? (
                'Hết hàng'
              ) : (
                <>
                  <BagIcon className="size-4" />
                  Thêm vào giỏ
                </>
              )}
            </Button>
          </div>

          {feedback ? (
            <div className="mt-4">
              <Alert tone={feedback.tone}>
                {feedback.text}
                {feedback.tone === 'success' ? (
                  <>
                    {' '}
                    <Link to="/gio-hang" className="font-semibold underline">
                      Xem giỏ hàng
                    </Link>
                  </>
                ) : null}
              </Alert>
            </div>
          ) : null}

          <div className="mt-6 border-t border-line pt-5">
            <h2 className="label-block mb-2">Chất liệu & mô tả</h2>
            <p className="max-w-[65ch] whitespace-pre-line text-ink-muted">{product.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
