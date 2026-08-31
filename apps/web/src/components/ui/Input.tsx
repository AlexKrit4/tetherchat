import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';

/**
 * Classic sinks a field into the deepest surface. Graphite lifts it instead and
 * outlines it, because its surfaces are too close together for a well to read
 * as an input on its own.
 */
const fieldSurface = () =>
  isGraphite() ? 'bg-surface-input shadow-hairline-strong' : 'bg-surface-tertiary';

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label
          htmlFor={id}
          className={cn(
            'text-xs font-bold uppercase tracking-[0.02em]',
            error ? 'text-danger' : 'text-text-subheading',
          )}
        >
          {label}
          {/* Decorative markers stay out of the accessible name. */}
          {required ? (
            <span aria-hidden className="ml-1 text-danger">
              *
            </span>
          ) : null}
          {error ? (
            <span aria-hidden className="ml-2 normal-case tracking-normal">
              — {error}
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {/* The visible error lives in the label; this announces it to screen readers. */}
      {error ? (
        <p role="alert" className="sr-only">
          {error}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        // 48px tall on phones so the field is easy to hit and iOS does not zoom.
        className={cn(
          'w-full rounded px-3 text-base text-text placeholder:text-text-faint',
          'h-12 md:h-10',
          'outline-none transition-shadow duration-150',
          fieldSurface(),
          error
            ? 'shadow-[0_0_0_1px_var(--red)] focus:shadow-[0_0_0_1px_var(--red),0_0_0_3px_color-mix(in_srgb,var(--red)_35%,transparent)]'
            : isGraphite()
              ? 'focus:shadow-[inset_0_0_0_1px_var(--border-strong),0_0_0_2px_var(--focus-ring)]'
              : 'focus:shadow-[0_0_0_2px_var(--focus-ring)]',
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full resize-none rounded px-3 py-2.5 text-base text-text',
          'placeholder:text-text-faint outline-none transition-shadow duration-150',
          fieldSurface(),
          isGraphite()
            ? 'focus:shadow-[inset_0_0_0_1px_var(--border-strong),0_0_0_2px_var(--focus-ring)]'
            : 'focus:shadow-[0_0_0_2px_var(--focus-ring)]',
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
});
