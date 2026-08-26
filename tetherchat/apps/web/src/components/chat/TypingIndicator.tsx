import { useT } from '@/i18n/useT';
import { useTypingUsers } from '@/stores/typingStore';

/** Sits in the 24px gutter under the composer, exactly like Discord. */
export function TypingIndicator({ channelId }: { channelId: string }) {
  const t = useT();
  const users = useTypingUsers(channelId);

  return (
    <div className="h-6 truncate pt-1 text-sm text-text" aria-live="polite">
      {users.length > 0 ? (
        <span className="flex items-center gap-1.5">
          <span className="flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1 w-1 animate-pulse-soft rounded-full bg-text-muted"
                style={{ animationDelay: `${dot * 160}ms` }}
              />
            ))}
          </span>
          <span className="truncate">
            <strong className="font-semibold">
              {describe(users.map((user) => user.username), t)}
            </strong>{' '}
            {users.length === 1 ? t('typing.one') : t('typing.many')}
          </span>
        </span>
      ) : null}
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
