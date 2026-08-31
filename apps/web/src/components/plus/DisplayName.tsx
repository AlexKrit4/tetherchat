import type { PublicUser } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { nameAccent } from '@/lib/plusDisplay';
import { PlusBadge } from './PlusBadge';

export function DisplayName({
  user,
  name,
  className,
  color,
}: {
  user: Pick<PublicUser, 'isPlus' | 'accentColor'>;
  name: string;
  className?: string;
  color?: string;
}) {
  const accent = nameAccent(user) ?? color;
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1', className)}>
      <span className="truncate font-medium" style={accent ? { color: accent } : undefined}>
        {name}
      </span>
      {user.isPlus ? <PlusBadge /> : null}
    </span>
  );
}
