import { SmilePlus } from 'lucide-react';
import type { Reaction } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';
import { useT } from '@/i18n/useT';
import { Tooltip } from '@/components/ui/Tooltip';

export interface ReactionsProps {
  reactions: Reaction[];
  onToggle: (emoji: string) => void;
  onAdd: () => void;
  disabled?: boolean;
}

export function Reactions({ reactions, onToggle, onAdd, disabled }: ReactionsProps) {
  const t = useT();
  const graphite = isGraphite();

  if (reactions.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <Tooltip
          key={reaction.emoji}
          content={t('chat.reactedWith', { count: reaction.count, emoji: reaction.emoji })}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(reaction.emoji)}
            aria-pressed={reaction.me}
            aria-label={t('chat.reactedWith', { count: reaction.count, emoji: reaction.emoji })}
            className={cn(
              'flex items-center justify-center gap-1 transition-colors',
              graphite
                ? 'h-6 min-w-8 rounded-full px-1.5 duration-fast ease-out'
                : 'h-7 min-w-[36px] rounded px-1.5',
              reaction.me
                ? 'bg-reaction-me-bg text-reaction-me-text ring-1 ring-brand'
                : cn(
                    'bg-surface-accent text-text-subheading hover:ring-1',
                    graphite ? 'hover:ring-hairline-strong' : 'hover:ring-reaction-ring',
                  ),
            )}
          >
            <span className={cn('leading-none', graphite ? 'text-sm' : 'text-base')}>
              {reaction.emoji}
            </span>
            <span className={cn('font-semibold tabular-nums', graphite ? 'text-2xs' : 'text-xs')}>
              {reaction.count}
            </span>
          </button>
        </Tooltip>
      ))}

      <Tooltip content={t('chat.addReaction')}>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          aria-label={t('chat.addReaction')}
          className={cn(
            'flex items-center justify-center text-text-muted transition-colors hover:text-text-heading',
            graphite ? 'h-6 w-7 rounded-full bg-surface-accent' : 'h-7 w-8 rounded bg-surface-accent',
          )}
        >
          <SmilePlus size={graphite ? 14 : 16} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
