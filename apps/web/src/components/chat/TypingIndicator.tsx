import { useT } from '@/i18n/useT';
import { isGraphite } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useTypingUsers } from '@/stores/typingStore';

/** Sits in the gutter under the composer. Classic follows Discord; Graphite follows Telegram. */
export function TypingIndicator({ channelId }: { channelId: string }) {
  const t = useT();
  const users = useTypingUsers(channelId);
  const graphite = isGraphite();

  if (users.length === 0) return null;

  return (
    <div
      className={cn(
        'truncate text-sm text-text',
        graphite ? 'h-7 px-3 pt-0.5' : 'h-6 pt-1',
      )}
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5">
        <span className="flex gap-0.5" aria-hidden>
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={cn(
                'animate-pulse-soft rounded-full bg-text-muted',
                graphite ? 'h-1.5 w-1.5' : 'h-1 w-1',
              )}
              style={{ animationDelay: `${dot * 160}ms` }}
            />
          ))}
        </span>
        <span className={cn('truncate', graphite && 'text-xs text-text-muted')}>
          {graphite ? (
            <>
              {describe(users.map((user) => user.username), t)} {t('typing.one')}
            </>
          ) : (
            <>
              <strong className="font-semibold">
                {describe(users.map((user) => user.username), t)}
              </strong>{' '}
              {users.length === 1 ? t('typing.one') : t('typing.many')}
            </>
          )}
        </span>
      </span>
    </div>
  );
}

function describe(
  names: string[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return t('typing.and', { a: names[0], b: names[1] });
  if (names.length === 3) return t('typing.three', { a: names[0], b: names[1], c: names[2] });
  return t('typing.people', { count: names.length });
}
