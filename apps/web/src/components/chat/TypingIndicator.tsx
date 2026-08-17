import { useTypingUsers } from '@/stores/typingStore';

/** Sits in the 24px gutter under the composer, exactly like Discord. */
export function TypingIndicator({ channelId }: { channelId: string }) {
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
            <strong className="font-semibold">{describe(users.map((user) => user.username))}</strong>{' '}
            {users.length === 1 ? 'is typing…' : 'are typing…'}
          </span>
        </span>
      ) : null}
    </div>
  );
}

function describe(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names.length} people`;
}
