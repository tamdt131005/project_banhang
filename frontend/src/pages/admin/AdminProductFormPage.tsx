import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  type CreateProductInput,
  type UpdateProductInput,
  adminGateway,
} from '../../api/admin';
import { ProductImageManager } from '../../components/admin/ProductImageManager';
import { Button } from '../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import { ArrowLeftIcon } from '../../components/ui/icons';
import { flattenCategories } from '../../lib/category';
import { errorMessage, fieldErrors } from '../../lib/errors';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminProductFormPageProps {}

/** Một dòng trong bảng biến thể, giữ dạng chuỗi để gõ thoải mái. */
interface VariantRow {
  /** null = biến thể mới, chưa có định danh ổn định từ backend. */
  id: number | null;
  size: string;
  color: string;
  /** Chỉ hiển thị cho biến thể đã tồn tại; không bao giờ gửi trong request cập nhật. */
  stock: number | null;
  /** Chỉ gửi khi tạo biến thể mới. */
  initialStock: string;
}

const EMPTY = { name: '', description: '', price: '', categoryId: '', isActive: true };
const EMPTY_VARIANT: VariantRow = {
  id: null,
  size: '',
  color: '',
  stock: null,
  initialStock: '0',
};

export function AdminProductFormPage({}: Readonly<AdminProductFormPageProps>) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEditing = id !== undefined && id !== 'moi';
  const productId = isEditing ? Number(id) : null;

  const [form, setForm] = useState(EMPTY);
  const [variants, setVariants] = useState<VariantRow[]>([{ ...EMPTY_VARIANT }]);

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminGateway.categories.list().then((response) => response.categories),
  });

  const product = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => adminGateway.products.detail(productId!).then((response) => response.product),
    enabled: productId !== null,
  });

  useEffect(() => {
    if (!product.data) return;
    setForm({
      name: product.data.name,
      description: product.data.description,
      price: String(product.data.price),
      categoryId: String(product.data.category.id),
      isActive: product.data.isActive,
    });
    setVariants(
      product.data.variants.map((variant) => ({
        id: variant.id,
        size: variant.size,
        color: variant.color,
        stock: variant.stock,
        initialStock: '',
      })),
    );
  }, [product.data]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
    if (productId !== null) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] });
    }
  }

  const save = useMutation({
    mutationFn: (
      mutation:
        | { kind: 'create'; input: CreateProductInput }
        | { kind: 'update'; input: UpdateProductInput },
    ) =>
      mutation.kind === 'create'
        ? adminGateway.products.create(mutation.input)
        : adminGateway.products.update(productId!, mutation.input),
    onSuccess: ({ product: saved }) => {
      invalidate();
      // Sau khi tạo mới, chuyển sang chế độ sửa để tải được ảnh lên —
      // API ảnh cần id sản phẩm nên không thể upload trước khi tạo.
      if (productId === null) void navigate(`/admin/san-pham/${saved.id}`, { replace: true });
    },
  });

  function setVariantAt(index: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fields = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      categoryId: Number(form.categoryId),
      isActive: form.isActive,
    };

    if (productId === null) {
      save.mutate({
        kind: 'create',
        input: {
          ...fields,
          variants: variants.map((row) => ({
            size: row.size.trim(),
            color: row.color.trim(),
            initialStock: Number(row.initialStock),
          })),
        },
      });
      return;
    }

    save.mutate({
      kind: 'update',
      input: {
        ...fields,
        variants: variants.map((row) =>
          row.id === null
            ? { size: row.size.trim(), color: row.color.trim(), initialStock: Number(row.initialStock) }
            : { id: row.id, size: row.size.trim(), color: row.color.trim() },
        ),
      },
    });
  }

  if (isEditing && product.isPending) return <Skeleton className="h-96" />;

  if (isEditing && product.isError) {
    return (
      <div className="space-y-4">
        <Alert>{errorMessage(product.error)}</Alert>
        <Link
          to="/admin/san-pham"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
        >
          <ArrowLeftIcon className="size-4" />
          Về danh sách sản phẩm
        </Link>
      </div>
    );
  }

  const errors = fieldErrors(save.error);
  const options = flattenCategories(categories.data ?? []);

  return (
    <div className="space-y-4">
      <Link
        to="/admin/san-pham"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-[160ms] hover:text-ink"
      >
        <ArrowLeftIcon className="size-4" />
        Danh sách sản phẩm
      </Link>

      <h1 className="text-xl font-semibold">
        {productId === null ? 'Thêm sản phẩm' : 'Sửa sản phẩm'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-surface p-4">
        {save.error ? <Alert>{errorMessage(save.error)}</Alert> : null}
        {save.isSuccess && productId !== null ? <Alert tone="success">Đã lưu.</Alert> : null}
        {categories.isError ? <Alert>{errorMessage(categories.error)}</Alert> : null}

        <TextField
          label="Tên sản phẩm"
          required
          value={form.name}
          error={errors['name']}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />

        <TextAreaField
          label="Mô tả"
          required
          rows={5}
          value={form.description}
          error={errors['description']}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Giá (VND) — các biến thể dùng chung"
            required
            type="number"
            min={1}
            inputMode="numeric"
            value={form.price}
            error={errors['price']}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
          />
          <SelectField
            label="Danh mục"
            required
            value={form.categoryId}
            error={errors['categoryId']}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
          >
            <option value="">— Chọn danh mục —</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            Biến thể size / màu <span className="text-red-600">*</span>
          </legend>
          <p className="text-xs text-ink-muted">
            Đồ một cỡ (mũ, túi) dùng size “Freesize”. Tồn kho của biến thể đã có chỉ được điều chỉnh
            trong{' '}
            <Link to="/admin/kho" className="font-medium text-accent underline">
              Kho hàng
            </Link>{' '}
            để có lịch sử kiểm toán. Biến thể còn tồn không thể bị xoá.
          </p>
          {errors['variants'] ? <p className="text-xs text-red-600">{errors['variants']}</p> : null}

          <div className="space-y-2">
            {variants.map((row, index) => {
              const cannotRemoveStockedVariant = row.id !== null && (row.stock ?? 0) > 0;
              return (
                <div key={row.id ?? `new-${index}`} className="flex flex-wrap items-center gap-2">
                  <input
                    value={row.size}
                    placeholder="Size (M, 30, Freesize…)"
                    aria-label={`Size biến thể ${index + 1}`}
                    onChange={(event) => setVariantAt(index, { size: event.target.value })}
                    className="h-9 w-40 rounded-control border border-line bg-sunken px-2.5 text-sm outline-none focus:border-accent"
                  />
                  <input
                    value={row.color}
                    placeholder="Màu (Đen, Trắng…)"
                    aria-label={`Màu biến thể ${index + 1}`}
                    onChange={(event) => setVariantAt(index, { color: event.target.value })}
                    className="h-9 w-40 rounded-control border border-line bg-sunken px-2.5 text-sm outline-none focus:border-accent"
                  />
                  {row.id === null ? (
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={row.initialStock}
                      placeholder="Tồn ban đầu"
                      aria-label={`Tồn kho ban đầu biến thể ${index + 1}`}
                      onChange={(event) => setVariantAt(index, { initialStock: event.target.value })}
                      className="tabular h-9 w-28 rounded-control border border-line bg-sunken px-2.5 text-sm outline-none focus:border-accent"
                    />
                  ) : (
                    <span className="tabular inline-flex h-9 w-28 items-center rounded-control border border-line bg-sunken px-2.5 text-sm text-ink-muted">
                      Tồn: {row.stock}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={variants.length <= 1 || cannotRemoveStockedVariant}
                    title={
                      cannotRemoveStockedVariant
                        ? 'Đưa tồn kho về 0 trong Kho hàng trước khi xoá biến thể.'
                        : undefined
                    }
                    onClick={() => setVariants((rows) => rows.filter((_, i) => i !== index))}
                  >
                    Xoá
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setVariants((rows) => [...rows, { ...EMPTY_VARIANT }])}
          >
            Thêm biến thể
          </Button>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            className="accent-accent"
          />
          Đang bán (bỏ chọn để ẩn khỏi cửa hàng)
        </label>

        <Button type="submit" loading={save.isPending}>
          {productId === null ? 'Tạo sản phẩm' : 'Lưu thay đổi'}
        </Button>
      </form>

      {productId !== null && product.data ? (
        <ProductImageManager productId={productId} images={product.data.images} />
      ) : (
        <p className="rounded-card border border-dashed border-line bg-surface p-4 text-sm text-ink-muted">
          Tạo sản phẩm xong sẽ thêm được ảnh — API ảnh cần mã sản phẩm nên không tải lên trước được.
        </p>
      )}
    </div>
  );
}
