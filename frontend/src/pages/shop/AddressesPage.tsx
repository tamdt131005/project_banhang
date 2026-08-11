import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type AddressInput, addressApi } from '../../api/addresses';
import { AddressForm } from '../../components/address/AddressForm';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Dialog } from '../../components/ui/Dialog';
import { Alert, EmptyState, Skeleton } from '../../components/ui/Feedback';
import { CheckIcon, PencilIcon, PinIcon, PlusIcon, TrashIcon } from '../../components/ui/icons';
import { errorMessage, fieldErrors } from '../../lib/errors';
import type { ApiAddress } from '../../types/api';

/** Trang định tuyến không nhận prop; dữ liệu lấy từ URL và API. */
export interface AddressesPageProps {}

export function AddressesPage({}: Readonly<AddressesPageProps>) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ApiAddress | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ApiAddress | null>(null);

  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressApi.list().then((response) => response.addresses),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['addresses'] });
  }

  const save = useMutation({
    mutationFn: (input: AddressInput) =>
      editing !== null && editing !== 'new'
        ? addressApi.update(editing.id, input)
        : addressApi.create(input),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => addressApi.setDefault(id),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: number) => addressApi.remove(id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
    },
  });

  if (addresses.isPending) return <Skeleton className="h-56" />;
  if (addresses.isError) return <Alert>{errorMessage(addresses.error)}</Alert>;

  const list = addresses.data;

  return (
    <div className="space-y-4">
      {setDefault.isError ? <Alert>{errorMessage(setDefault.error)}</Alert> : null}
      {remove.isError ? <Alert>{errorMessage(remove.error)}</Alert> : null}

      {list.length === 0 ? (
        <EmptyState
          title="Chưa có địa chỉ nào"
          description="Thêm địa chỉ để đặt hàng nhanh hơn."
          icon={<PinIcon className="size-6" />}
          action={
            <Button
              onClick={() => {
                save.reset();
                setEditing('new');
              }}
            >
              <PlusIcon className="size-4" />
              Thêm địa chỉ
            </Button>
          }
        />
      ) : (
        /* Danh sách dạng hàng ngăn cách bằng kẻ mảnh theo kiểu sàn TMĐT —
           tên | SĐT một dòng, địa chỉ dưới, thao tác dồn về mép phải. */
        <section className="rounded-card border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:p-5">
            <div>
              <h1 className="text-xl font-semibold">Sổ địa chỉ</h1>
              <p className="mt-0.5 text-sm text-ink-muted">Quản lý địa chỉ nhận hàng của bạn.</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                save.reset();
                setEditing('new');
              }}
            >
              <PlusIcon className="size-3.5" />
              Thêm địa chỉ mới
            </Button>
          </div>

          <ul className="divide-y divide-line">
            {list.map((address) => (
              <li
                key={address.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{address.fullName}</span>
                    <span aria-hidden="true" className="h-4 w-px bg-line" />
                    <span className="tabular text-sm text-ink-muted">{address.phone}</span>
                  </div>

                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink-muted">
                    <PinIcon className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {address.line1}, {address.ward}, {address.district}, {address.province}
                    </span>
                  </p>

                  {address.isDefault ? (
                    <span className="mt-2 inline-block rounded-full border border-accent px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-accent uppercase">
                      Mặc định
                    </span>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <div className="flex gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        save.reset();
                        setEditing(address);
                      }}
                    >
                      <PencilIcon className="size-3" />
                      Sửa
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleting(address)}>
                      <TrashIcon className="size-3.5" />
                      Xoá
                    </Button>
                  </div>

                  {/* Hiện cả ở địa chỉ mặc định nhưng khoá lại — nhìn là hiểu
                      vì sao không bấm được, đỡ thắc mắc nút biến đi đâu. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={address.isDefault}
                    loading={setDefault.isPending && setDefault.variables === address.id}
                    onClick={() => setDefault.mutate(address.id)}
                  >
                    <CheckIcon className="size-3.5" />
                    Thiết lập mặc định
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={editing !== null}
        title={editing === 'new' ? 'Địa chỉ mới' : 'Sửa địa chỉ'}
        onClose={() => setEditing(null)}
      >
        <AddressForm
          /* Dialog luôn nằm trong DOM nên form phải remount theo từng địa chỉ,
             nếu không mở "Sửa B" sẽ thấy dữ liệu của A còn dính lại. */
          key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
          {...(editing !== null && editing !== 'new' ? { initial: editing } : {})}
          loading={save.isPending}
          errorMessage={save.error ? errorMessage(save.error) : undefined}
          fieldErrors={fieldErrors(save.error)}
          onSubmit={(input) => save.mutate(input)}
          onCancel={() => setEditing(null)}
        />
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Xoá địa chỉ này?"
        description={
          deleting
            ? `${deleting.fullName} — ${deleting.line1}, ${deleting.ward}, ${deleting.district}`
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
