import { cn } from '@/lib/cn';

type MonitorBotKeyboardProps = {
  disabled?: boolean;
  onCommand: (command: string) => void;
  className?: string;
};

const BUTTONS = [
  { label: '📊 Статус', command: 'статус' },
  { label: '💾 Диск', command: 'диск' },
  { label: '🐳 Docker', command: 'docker' },
  { label: '🔌 API', command: 'api' },
  { label: '🛡 Целостность', command: 'целостность' },
  { label: '❓ Помощь', command: 'помощь' },
] as const;

export function MonitorBotKeyboard({ disabled, onCommand, className }: MonitorBotKeyboardProps) {
  return (
    <div className={cn('flex flex-wrap gap-1 px-4 pb-1', className)}>
      {BUTTONS.map((button) => (
        <button
          key={button.command}
          type="button"
          disabled={disabled}
          onClick={() => onCommand(button.command)}
          className={cn(
            'rounded-full bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-subheading shadow-hairline',
            'hover:bg-surface-floating hover:text-text-heading disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
