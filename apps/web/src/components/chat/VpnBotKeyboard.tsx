import { cn } from '@/lib/cn';

type VpnBotKeyboardProps = {
  disabled?: boolean;
  onCommand: (command: string) => void;
  className?: string;
};

const MAIN_BUTTONS = [
  { label: '🛒 Тарифы', command: 'тарифы' },
  { label: '📱 Моя подписка', command: 'подписка' },
  { label: '❓ Помощь', command: 'помощь' },
  { label: '💬 Поддержка', command: 'поддержка' },
] as const;

const TARIFF_BUTTONS = [
  { label: '📦 Ограниченный', command: 'tarif:limited' },
  { label: '♾️ Вечный', command: 'tarif:eternal' },
  { label: '🛠 Свой тариф', command: 'tarif:custom' },
] as const;

export function VpnBotKeyboard({ disabled, onCommand, className }: VpnBotKeyboardProps) {
  return (
    <div className={cn('flex flex-col gap-1 px-4 pb-1', className)}>
      <div className="flex flex-wrap gap-1">
        {MAIN_BUTTONS.map((button) => (
          <VpnBotButton
            key={button.command}
            label={button.label}
            disabled={disabled}
            onClick={() => onCommand(button.command)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {TARIFF_BUTTONS.map((button) => (
          <VpnBotButton
            key={button.command}
            label={button.label}
            disabled={disabled}
            onClick={() => onCommand(button.command)}
          />
        ))}
      </div>
    </div>
  );
}

function VpnBotButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-subheading shadow-hairline',
        'hover:bg-surface-floating hover:text-text-heading disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {label}
    </button>
  );
}
