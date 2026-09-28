import { useState } from 'react';
import {
  CANCEL_REASON_MAX_LENGTH,
  cancelReasonPayload,
  type CancelReasonMode,
  type CancelReasonOption,
  type CancelReasonPayload,
  type CancelReasonSelection,
} from '../../lib/order-cancel';

export interface CancelReasonFormProps {
  reasons: readonly CancelReasonOption[];
  mode: CancelReasonMode;
  reasonCode: string;
  customReason: string;
  onModeChange: (mode: CancelReasonMode) => void;
  onReasonCodeChange: (code: string) => void;
  onCustomReasonChange: (value: string) => void;
}

const CONTROL =
  'w-full rounded-t-control border-0 border-b border-line bg-sunken px-3 text-sm text-ink outline-none transition-[border-color,box-shadow,background-color] duration-[160ms] focus:border-accent focus:shadow-[0_1px_0_0_var(--color-accent)]';

export function CancelReasonForm({
  reasons,
  mode,
  reasonCode,
  customReason,
  onModeChange,
  onReasonCodeChange,
  onCustomReasonChange,
}: Readonly<CancelReasonFormProps>) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-ink">
        Lý do huỷ
        <span className="ml-0.5 text-accent">*</span>
      </legend>

      <label className="flex cursor-pointer items-center gap-2 rounded-control border border-line px-3 py-2 text-sm has-checked:border-accent has-checked:bg-accent-soft">
        <input
          type="radio"
          name="cancel-reason-mode"
          className="accent-accent"
          checked={mode === 'preset'}
          onChange={() => onModeChange('preset')}
        />
        Lý do có sẵn
      </label>

      {mode === 'preset' ? (
        <select
          aria-label="Lý do có sẵn"
          value={reasonCode}
          onChange={(event) => onReasonCodeChange(event.target.value)}
          className={`${CONTROL} h-11`}
        >
          <option value="">Chọn lý do</option>
          {reasons.map((reason) => (
            <option key={reason.code} value={reason.code}>
              {reason.label}
            </option>
          ))}
        </select>
      ) : null}

      <label className="flex cursor-pointer items-center gap-2 rounded-control border border-line px-3 py-2 text-sm has-checked:border-accent has-checked:bg-accent-soft">
        <input
          type="radio"
          name="cancel-reason-mode"
          className="accent-accent"
          checked={mode === 'custom'}
          onChange={() => onModeChange('custom')}
        />
        Tự điền lý do
      </label>

      {mode === 'custom' ? (
        <textarea
          aria-label="Lý do tự điền"
          value={customReason}
          maxLength={CANCEL_REASON_MAX_LENGTH}
          rows={3}
          placeholder="Nhập lý do huỷ đơn"
          onChange={(event) => onCustomReasonChange(event.target.value)}
          className={`${CONTROL} py-2.5`}
        />
      ) : null}

      <p className="text-xs text-ink-muted">
        {mode === 'custom'
          ? 'Bắt buộc nhập lý do, tối đa 500 ký tự.'
          : 'Bắt buộc chọn một lý do có sẵn, hoặc chuyển sang tự điền.'}
      </p>
    </fieldset>
  );
}

export function useCancelReason() {
  const [mode, setMode] = useState<CancelReasonMode>('preset');
  const [reasonCode, setReasonCode] = useState('');
  const [customReason, setCustomReason] = useState('');

  const selection: CancelReasonSelection = { mode, reasonCode, customReason };
  const payload: CancelReasonPayload | null = cancelReasonPayload(selection);

  function reset() {
    setMode('preset');
    setReasonCode('');
    setCustomReason('');
  }

  return {
    mode,
    reasonCode,
    customReason,
    setMode,
    setReasonCode,
    setCustomReason,
    payload,
    reset,
  };
}
