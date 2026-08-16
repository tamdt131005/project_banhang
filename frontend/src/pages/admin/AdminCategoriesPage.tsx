import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { type CategoryInput, adminGateway } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SelectField, TextField } from '../../components/ui/Field';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import {
  CheckIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TagIcon,
  TrashIcon,
} from '../../components/ui/icons';
import { flattenCategories } from '../../lib/category';
import { errorMessage, fieldErrors } from '../../lib/errors';
import type { ApiCategory } from '../../types/api';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AdminCategoriesPageProps {}

export function AdminCategoriesPage({}: Readonly<AdminCategoriesPageProps>) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);
  // Sửa tại chỗ từng dòng: đổi tên, chuyển nhánh cha, đổi thứ tự hiển thị.
  const [editing, setEditing] = useState<{
    id: number;
    name: string;
    parentId: string;
    sortOrder: string;
  } | null>(null);

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminGateway.categories.list().then((response) => response.categories),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
  }

  const create = useMutation({
    mutationFn: (input: CategoryInput) => adminGateway.categories.create(input),
    onSuccess: () => {
      invalidate();
      setName('');
      setParentId('');
    },
  });

  const update = useMutation({
    mutationFn: (input: { id: number; patch: Partial<CategoryInput> }) =>
      adminGateway.categories.update(input.id, input.patch),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminGateway.categories.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
    },
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      ...(parentId ? { parentId: Number(parentId) } : {}),
    });
  }

  if (categories.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (categories.isError) return <Alert>{errorMessage(categories.error)}</Alert>;

  const options = flattenCategories(categories.data);
  const errors = fieldErrors(create.error);

  function renderRow(category: ApiCategory, depth: number, parentOf: number | null) {
    const childTotal = category.children.reduce((sum, child) => sum + child.productCount, 0);
    const isEditing = editing?.id === category.id;

    return (
      <li key={category.id} className="transition-colors">
        {isEditing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate({
                id: category.id,
                patch: {
                  name: editing.name.trim(),
                  // Chuỗi rỗng = đưa lên làm danh mục gốc.
                  parentId: editing.parentId === '' ? null : Number(editing.parentId),
                  sortOrder: Number(editing.sortOrder) || 0,
                },
              });
            }}
            className="flex flex-wrap items-center gap-2 rounded-control bg-accent-soft/30 border border-accent/30 p-2.5 my-1"
            style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
          >
            <input
              value={editing.name}
              autoFocus
              required
              aria-label="Tên danh mục"
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="h-9 min-w-44 flex-1 rounded-control border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
            />
            <select
              value={editing.parentId}
              aria-label="Danh mục cha"
              onChange={(event) => setEditing({ ...editing, parentId: event.target.value })}
              className="h-9 rounded-control border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="">— Danh mục gốc —</option>
              {options
                // Không cho chọn chính nó làm cha; backend cũng chặn vòng lặp.
                .filter((option) => option.id !== category.id)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </select>
            <input
              type="number"
              value={editing.sortOrder}
              aria-label="Thứ tự hiển thị"
              title="Thứ tự hiển thị — số nhỏ lên trước"
              onChange={(event) => setEditing({ ...editing, sortOrder: event.target.value })}
              className="tabular h-9 w-20 rounded-control border border-line bg-surface px-2 text-center text-sm outline-none focus:border-accent"
            />
            <Button type="submit" size="sm" loading={update.isPending} className="inline-flex items-center gap-1">
              <CheckIcon className="size-3.5" />
              <span>Lưu</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Huỷ
            </Button>
          </form>
        ) : (
          <div
            className="group flex items-center justify-between gap-3 rounded-control px-3 py-2.5 transition hover:bg-sunken border-b border-line/40 last:border-0"
            style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <TagIcon className="size-4 shrink-0 text-ink-muted/70 group-hover:text-accent transition" />
              <span className="font-semibold text-sm text-ink truncate">
                {category.name}
              </span>
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-ink-muted shrink-0">
                {category.productCount} sản phẩm
                {category.children.length > 0 ? ` · ${childTotal} ở nhánh con` : ''}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition">
              <span className="text-[0.6875rem] text-ink-muted font-mono mr-1">
                Thứ tự: {category.sortOrder}
              </span>

              <button
                type="button"
                onClick={() =>
                  setEditing({
                    id: category.id,
                    name: category.name,
                    parentId: parentOf === null ? '' : String(parentOf),
                    sortOrder: String(category.sortOrder),
                  })
                }
                className="inline-flex items-center gap-1 rounded-control border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent"
              >
                <PencilIcon className="size-3" />
                <span>Sửa</span>
              </button>

              <button
                type="button"
                onClick={() => setDeleting({ id: category.id, name: category.name })}
                className="inline-flex items-center gap-1 rounded-control border border-red-200 bg-surface px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                <TrashIcon className="size-3" />
                <span>Xoá</span>
              </button>
            </div>
          </div>
        )}

        {category.children.length > 0 ? (
          <ul className="border-l border-line/50 ml-4 my-0.5">
            {category.children.map((child) => renderRow(child, depth + 1, category.id))}
          </ul>
        ) : null}
      </li>
    );
  }

  const totalCategories = options.length;

  return (
    <div className="space-y-6">
      {/* Header & Quick stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Quản lý Danh mục</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Cấu trúc cây danh mục sản phẩm hiển thị trên menu điều hướng và bộ lọc của cửa hàng.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={invalidate}
          className="inline-flex items-center gap-1.5"
        >
          <RefreshIcon className="size-3.5" />
          <span>Làm mới ({totalCategories} danh mục)</span>
        </Button>
      </div>

      {/* Guide Note */}
      <div className="flex items-start gap-3 rounded-card border border-accent/25 bg-accent-soft/30 p-4 text-xs text-ink-muted">
        <InfoIcon className="size-4 shrink-0 text-accent mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-ink">Lưu ý khi thiết lập cây danh mục:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <strong>Cấp bậc:</strong> Danh mục con sẽ tự động hiển thị lùi vào trong menu dropdown của khách hàng.
            </li>
            <li>
              <strong>Thứ tự hiển thị:</strong> Số thứ tự nhỏ hơn sẽ được ưu tiên hiển thị trước.
            </li>
            <li>
              <strong>Xoá danh mục:</strong> Chỉ có thể xoá khi danh mục không còn sản phẩm và không có danh mục con.
            </li>
          </ul>
        </div>
      </div>

      {remove.isError ? <Alert>{errorMessage(remove.error)}</Alert> : null}
      {update.isError ? <Alert>{errorMessage(update.error)}</Alert> : null}

      {/* Form Tạo Mới Danh Mục */}
      <form
        onSubmit={handleCreate}
        className="rounded-card border border-line bg-surface p-5 shadow-xs space-y-4"
      >
        <h2 className="font-semibold text-sm text-ink flex items-center gap-2">
          <PlusIcon className="size-4 text-accent" />
          <span>Tạo danh mục mới</span>
        </h2>

        <div className="grid gap-3 sm:grid-cols-[1.5fr_1.5fr_auto] sm:items-end">
          <TextField
            label="Tên danh mục"
            required
            placeholder="Ví dụ: Áo sơ mi nam, Quần tây..."
            value={name}
            error={errors['name']}
            onChange={(event) => setName(event.target.value)}
          />

          <SelectField
            label="Danh mục cha (trực thuộc)"
            value={parentId}
            error={errors['parentId']}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">— Danh mục gốc (Cấp 1) —</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <Button type="submit" loading={create.isPending} className="inline-flex items-center gap-1.5 h-10 px-5">
            <PlusIcon className="size-4" />
            <span>Thêm danh mục</span>
          </Button>
        </div>

        {create.error ? <Alert>{errorMessage(create.error)}</Alert> : null}
      </form>

      {/* Cây Danh Mục */}
      <section aria-label="Cây phân cấp danh mục" className="rounded-card border border-line bg-surface overflow-hidden shadow-xs">
        <div className="border-b border-line bg-sunken/40 px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-ink-muted">
            Cây phân cấp danh mục ({totalCategories})
          </h2>
        </div>

        {categories.data.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Chưa có danh mục nào"
              description="Hãy thêm danh mục đầu tiên bằng biểu mẫu phía trên."
              icon={<TagIcon className="size-8 text-ink-muted/60" />}
            />
          </div>
        ) : (
          <div className="p-3">
            <ul className="space-y-1">{categories.data.map((category) => renderRow(category, 0, null))}</ul>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Xoá danh mục này?"
        description={
          deleting
            ? `"${deleting.name}" chỉ xoá được khi không còn danh mục con và không còn sản phẩm nào thuộc danh mục.`
            : undefined
        }
        confirmLabel="Xoá vĩnh viễn"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
