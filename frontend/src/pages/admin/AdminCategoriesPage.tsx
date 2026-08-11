import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { type CategoryInput, adminGateway } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SelectField, TextField } from '../../components/ui/Field';
import { Alert, Skeleton } from '../../components/ui/Feedback';
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/ui/icons';
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
    create.mutate({
      name,
      ...(parentId ? { parentId: Number(parentId) } : {}),
    });
  }

  if (categories.isPending) return <Skeleton className="h-64" />;
  if (categories.isError) return <Alert>{errorMessage(categories.error)}</Alert>;

  const options = flattenCategories(categories.data);
  const errors = fieldErrors(create.error);

  function renderRow(category: ApiCategory, depth: number, parentOf: number | null) {
    const childTotal = category.children.reduce((sum, child) => sum + child.productCount, 0);
    const isEditing = editing?.id === category.id;

    return (
      <li key={category.id}>
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
            className="flex flex-wrap items-center gap-2 rounded-control bg-sunken px-2 py-2"
            style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          >
            <input
              value={editing.name}
              autoFocus
              required
              aria-label="Tên danh mục"
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="h-9 min-w-40 flex-1 rounded-control border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent"
            />
            <select
              value={editing.parentId}
              aria-label="Danh mục cha"
              onChange={(event) => setEditing({ ...editing, parentId: event.target.value })}
              className="h-9 rounded-control border border-line bg-surface px-2 text-sm outline-none focus:border-accent"
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
              className="tabular h-9 w-20 rounded-control border border-line bg-surface px-2 text-sm outline-none focus:border-accent"
            />
            <Button type="submit" size="sm" loading={update.isPending}>
              <CheckIcon className="size-3.5" />
              Lưu
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Huỷ
            </Button>
          </form>
        ) : (
          <div
            className="flex items-center gap-1.5 rounded-control px-2 py-2 hover:bg-sunken"
            style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          >
            <span className="flex-1 text-sm">
              {category.name}
              <span className="ml-2 text-xs text-ink-muted">
                {category.productCount} sản phẩm
                {category.children.length > 0 ? ` · ${childTotal} ở danh mục con` : ''}
              </span>
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
              className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-[160ms] hover:bg-surface hover:text-ink"
            >
              <PencilIcon className="size-3" />
              Sửa
            </button>

            <button
              type="button"
              onClick={() => setDeleting({ id: category.id, name: category.name })}
              className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              <TrashIcon className="size-3" />
              Xoá
            </button>
          </div>
        )}

        {category.children.length > 0 ? (
          <ul>{category.children.map((child) => renderRow(child, depth + 1, category.id))}</ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Danh mục</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Cây danh mục quyết định thanh điều hướng và bộ lọc ngoài cửa hàng. Số thứ tự nhỏ hiện
          trước.
        </p>
      </div>

      {remove.isError ? <Alert>{errorMessage(remove.error)}</Alert> : null}
      {update.isError ? <Alert>{errorMessage(update.error)}</Alert> : null}

      <form
        onSubmit={handleCreate}
        className="grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <TextField
          label="Tên danh mục mới"
          required
          value={name}
          error={errors['name']}
          onChange={(event) => setName(event.target.value)}
        />

        <SelectField
          label="Danh mục cha"
          value={parentId}
          error={errors['parentId']}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">— Không có (danh mục gốc) —</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <Button type="submit" loading={create.isPending}>
          <PlusIcon className="size-4" />
          Thêm
        </Button>

        {create.error ? (
          <div className="sm:col-span-3">
            <Alert>{errorMessage(create.error)}</Alert>
          </div>
        ) : null}
      </form>

      <div className="rounded-card border border-line bg-surface p-2">
        <ul>{categories.data.map((category) => renderRow(category, 0, null))}</ul>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Xoá danh mục này?"
        description={
          deleting
            ? `"${deleting.name}" chỉ xoá được khi không còn danh mục con và không còn sản phẩm nào.`
            : undefined
        }
        confirmLabel="Xoá"
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
