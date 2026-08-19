import { cn } from '@/lib/cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/**
 * 44×24px switch. The thumb is pinned to the left of the track with `left`, then
 * translated by exactly (track − thumb − 2×inset) so both on and off sit inside
 * the pill. An unpositioned absolute thumb plus translateX is what made the
 * knobs look crooked on web and in the Android WebView.
 */
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150',
        checked ? 'bg-success' : 'bg-[#72767d]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        aria-hidden
        data-thumb
        className={cn(
          'pointer-events-none absolute left-[2px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked && 'translate-x-[20px]',
        )}
      />
    </button>
  );
}
