import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

/**
 * Kiểu "filled bottom-line" theo DESIGN.md v2.1: nền chìm, chỉ viền dưới,
 * bo nhẹ hai góc trên. Focus tô viền dưới màu nhấn và dày lên bằng
 * box-shadow 1px (không đổi border-width để bố cục không nhích 1px).
 */
const CONTROL =
  'w-full rounded-t-control border-0 border-b border-line bg-sunken px-3 text-sm text-ink outline-none transition-[border-color,box-shadow,background-color] duration-[160ms] placeholder:text-ink-muted focus:border-accent focus:shadow-[0_1px_0_0_var(--color-accent)] disabled:opacity-50';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; describedBy: string | undefined }) => ReactNode;
}

/**
 * Nhãn nằm TRÊN ô, chữ gợi ý và lỗi nằm DƯỚI — theo mục 4 của DESIGN.md.
 * Component tự sinh id và nối `aria-describedby` để trình đọc màn hình đọc
 * được thông báo lỗi, thứ rất dễ quên khi viết tay từng form.
 */
export function Field({ label, hint, error, required, children }: Readonly<FieldProps>) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-ink">
        {label}
        {required === true ? <span className="ml-0.5 text-accent">*</span> : null}
      </label>

      {children({ id, describedBy })}

      {error ? (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, className = '', ...rest }: Readonly<TextFieldProps>) {
  return (
    <Field label={label} hint={hint} error={error} required={rest.required}>
      {({ id, describedBy }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`${CONTROL} h-11 ${error ? 'border-red-500 shadow-[0_1px_0_0_#b91c1c]' : ''} ${className}`}
          {...rest}
        />
      )}
    </Field>
  );
}

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({
  label,
  hint,
  error,
  className = '',
  ...rest
}: Readonly<TextAreaFieldProps>) {
  return (
    <Field label={label} hint={hint} error={error} required={rest.required}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`${CONTROL} py-2.5 ${error ? 'border-red-500 shadow-[0_1px_0_0_#b91c1c]' : ''} ${className}`}
          {...rest}
        />
      )}
    </Field>
  );
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function SelectField({
  label,
  hint,
  error,
  className = '',
  children,
  ...rest
}: Readonly<SelectFieldProps>) {
  return (
    <Field label={label} hint={hint} error={error} required={rest.required}>
      {({ id, describedBy }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          className={`${CONTROL} h-11 ${error ? 'border-red-500 shadow-[0_1px_0_0_#b91c1c]' : ''} ${className}`}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
}
