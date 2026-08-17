import { useMemo } from 'react';
import type { PresenceStatus, PublicUser } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { usePresence } from '@/stores/presenceStore';

const FALLBACK_COLORS = ['#5865f2', '#3ba55d', '#faa81a', '#ed4245', '#eb459e', '#9b59b6'];

function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

const statusColor: Record<PresenceStatus, string> = {
  online: 'var(--green)',
  idle: 'var(--yellow)',
  dnd: 'var(--red)',
  invisible: 'var(--grey)',
  offline: 'var(--grey)',
};

export interface AvatarProps {
  user: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'status'>;
  size?: number;
  showStatus?: boolean;
  className?: string;
  /** Background the status dot is cut out of, so it reads as a notch. */
  ringColor?: string;
}

export function Avatar({
  user,
  size = 40,
  showStatus = false,
  className,
  ringColor = 'var(--bg-primary)',
}: AvatarProps) {
  const status = usePresence(user.id, user.status);
  const name = user.displayName ?? user.username;
  const fallback = useMemo(() => colorFor(user.id || name), [user.id, name]);
  const dot = Math.max(10, Math.round(size * 0.3));

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full font-medium text-white"
          style={{ background: fallback, fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {initials(name)}
        </div>
      )}

      {showStatus ? (
        // Decorative: presence is conveyed by the member list section headings,
        // and an aria-label here would leak "offline" into every button name.
        <span
          aria-hidden
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: dot,
            height: dot,
            background: statusColor[status],
            boxShadow: `0 0 0 ${Math.max(2, Math.round(size * 0.06))}px ${ringColor}`,
          }}
        />
      ) : null}
    </div>
  );
}

export function StatusDot({
  status,
  size = 10,
  className,
}: {
  status: PresenceStatus;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ width: size, height: size, background: statusColor[status] }}
    />
  );
}
