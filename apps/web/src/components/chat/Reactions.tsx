import { SmilePlus } from 'lucide-react';
import type { Reaction } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/ui/Tooltip';

export interface ReactionsProps {
  reactions: Reaction[];
  onToggle: (emoji: string) => void;
  onAdd: () => void;
  disabled?: boolean;
}

export function Reactions({ reactions, onToggle, onAdd, disabled }: ReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <Tooltip key={reaction.emoji} content={`${reaction.count} reacted with ${reaction.emoji}`}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(reaction.emoji)}
            aria-pressed={reaction.me}
            className={cn(
              'flex h-7 min-w-[36px] items-center justify-center gap-1 rounded px-1.5 transition-colors',
              reaction.me
                ? 'bg-[rgba(88,101,242,0.18)] text-[#c9cdfb] ring-1 ring-brand'
                : 'bg-surface-accent text-text-subheading hover:ring-1 hover:ring-[#4f545c]',
            )}
          >
            <span className="text-base leading-none">{reaction.emoji}</span>
            <span className="text-xs font-semibold tabular-nums">{reaction.count}</span>
          </button>
        </Tooltip>
      ))}

      <Tooltip content="Add reaction">
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          aria-label="Add reaction"
          className="flex h-7 w-8 items-center justify-center rounded bg-surface-accent text-text-muted transition-colors hover:text-text-heading"
        >
          <SmilePlus size={16} aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
