import { type FormEvent, useState } from 'react';
import type { AddressInput } from '../../api/addresses';
import type { ApiAddress } from '../../types/api';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import { Alert } from '../ui/Feedback';

export interface AddressFormProps {
  initial?: ApiAddress;
  submitLabel?: string;
  loading?: boolean;
  errorMessage?: string;
  fieldErrors?: Record<string, string>;
  onSubmit: (input: AddressInput) => void;
  onCancel?: () => void;
}

const EMPTY: AddressInput = {
  fullName: '',
  phone: '',
  line1: '',
  ward: '',
  district: '',
  province: '',
};

export function AddressForm({
  initial,
  submitLabel = 'Lưu địa chỉ',
  loading = false,
  errorMessage,
  fieldErrors = {},
  onSubmit,
  onCancel,
}: Readonly<AddressFormProps>) {
  const [form, setForm] = useState<AddressInput>(() =>
    initial
      ? {
          fullName: initial.fullName,
          phone: initial.phone,
          line1: initial.line1,
          ward: initial.ward,
          district: initial.district,
          province: initial.province,
        }
      : EMPTY,
  );

  function update(key: keyof AddressInput) {
    return (event: { target: { value: string } }) =>
      setForm((previous) => ({ ...previous, [key]: event.target.value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {errorMessage ? <Alert>{errorMessage}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Tên người nhận"
          required
          autoComplete="name"
          value={form.fullName}
          error={fieldErrors['fullName']}
          onChange={update('fullName')}
        />
        <TextField
          label="Số điện thoại"
          required
          inputMode="numeric"
          autoComplete="tel"
          hint="10 chữ số, bắt đầu bằng 0"
          value={form.phone}
          error={fieldErrors['phone']}
          onChange={update('phone')}
        />
      </div>

      <TextField
        label="Địa chỉ"
        required
        autoComplete="street-address"
        hint="Số nhà, tên đường"
        value={form.line1}
        error={fieldErrors['line1']}
        onChange={update('line1')}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label="Phường/Xã"
          required
          value={form.ward}
          error={fieldErrors['ward']}
          onChange={update('ward')}
        />
        <TextField
          label="Quận/Huyện"
          required
          value={form.district}
          error={fieldErrors['district']}
          onChange={update('district')}
        />
        <TextField
          label="Tỉnh/Thành phố"
          required
          value={form.province}
          error={fieldErrors['province']}
          onChange={update('province')}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Huỷ
          </Button>
        ) : null}
      </div>
    </form>
  );
}
