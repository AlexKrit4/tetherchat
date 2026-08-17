import { useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import type { PublicUser, Role, ServerMember } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useMembers } from '@/hooks/useServers';
import { Avatar } from '@/components/ui/Avatar';
import { SidebarSkeleton } from '@/components/ui/Skeleton';
import { UserProfileDialog } from '@/components/modals/UserProfileDialog';
import { usePresenceStore } from '@/stores/presenceStore';
import { useAuthStore } from '@/stores/authStore';

interface MemberSection {
  key: string;
  label: string;
  members: ServerMember[];
}

/**
 * Members grouped exactly like Discord: one section per hoisted role (highest
 * first, online members only), then a single Offline section at the bottom.
 */
function buildSections(
  members: ServerMember[],
  roles: Role[],
  liveStatuses: Record<string, string>,
): MemberSection[] {
  const statusOf = (member: ServerMember) => liveStatuses[member.userId] ?? member.user.status;
  const online = members.filter((member) => statusOf(member) !== 'offline');
  const offline = members.filter((member) => statusOf(member) === 'offline');

  const hoisted = [...roles]
    .filter((role) => role.hoist && !role.isDefault)
    .sort((a, b) => b.position - a.position);

  const byName = (a: ServerMember, b: ServerMember) =>
    (a.nickname ?? a.user.displayName ?? a.user.username).localeCompare(
      b.nickname ?? b.user.displayName ?? b.user.username,
    );

  const sections: MemberSection[] = [];
  const assigned = new Set<string>();

  for (const role of hoisted) {
    const group = online.filter(
      (member) => !assigned.has(member.userId) && member.roleIds.includes(role.id),
    );
    if (group.length === 0) continue;
    for (const member of group) assigned.add(member.userId);
    sections.push({ key: role.id, label: role.name, members: group.sort(byName) });
  }

  const remaining = online.filter((member) => !assigned.has(member.userId));
  if (remaining.length > 0) {
    sections.push({ key: 'online', label: 'Online', members: remaining.sort(byName) });
  }

  if (offline.length > 0) {
    sections.push({ key: 'offline', label: 'Offline', members: offline.sort(byName) });
  }

  return sections;
}

export interface MemberListProps {
  className?: string;
  /** Mobile uses 48px rows; the desktop column uses 42px ones. */
  compact?: boolean;
}

export function MemberList({ className, compact = true }: MemberListProps) {
  const { server, serverId, isDm, conversation } = useChatTarget();
  const { data: members, isLoading } = useMembers(serverId);
  const liveStatuses = usePresenceStore((state) => state.statuses);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  const sections = useMemo(
    () => buildSections(members ?? [], server?.roles ?? [], liveStatuses),
    [liveStatuses, members, server?.roles],
  );

  const roleColorOf = useMemo(() => {
    const colours = new Map<string, string>();
    const byPosition = [...(server?.roles ?? [])].sort((a, b) => b.position - a.position);
    for (const member of members ?? []) {
      const role = byPosition.find(
        (entry) => entry.color && !entry.isDefault && member.roleIds.includes(entry.id),
      );
      if (role?.color) colours.set(member.userId, role.color);
    }
    return colours;
  }, [members, server?.roles]);

  if (isDm) {
    return (
      <aside className={cn('flex flex-col bg-base-secondary', className)}>
        <div className="scroller flex-1 px-2 py-4">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.02em] text-text-muted">
            {conversation?.isGroup ? `Members — ${conversation.members.length}` : 'Conversation'}
          </p>
          <ul className="flex flex-col gap-0.5">
            {conversation?.members.map((member) => (
              <li key={member.id}>
                <MemberRow
                  user={member}
                  label={member.displayName ?? member.username}
                  hint={member.customStatus}
                  colour={null}
                  isOwner={false}
                  compact={compact}
                  onOpen={() => setProfileFor(member.id)}
                />
              </li>
            ))}
          </ul>
        </div>
        {profileFor ? (
          <UserProfileDialog userId={profileFor} open onClose={() => setProfileFor(null)} />
        ) : null}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Members"
      className={cn('flex flex-col bg-base-secondary', className)}
    >
      <div className="scroller scroller-hover flex-1 px-2 py-4">
        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          sections.map((section) => (
            <section key={section.key} className="mb-4 last:mb-0">
              <h3 className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-[0.02em] text-text-muted">
                {section.label} — {section.members.length}
              </h3>
              <ul className="flex flex-col gap-0.5">
                {section.members.map((member) => (
                  <li key={member.userId}>
                    <MemberRow
                      user={member.user}
                      label={member.nickname ?? member.user.displayName ?? member.user.username}
                      hint={member.user.customStatus}
                      colour={roleColorOf.get(member.userId) ?? null}
                      isOwner={member.userId === server?.ownerId}
                      dimmed={section.key === 'offline'}
                      isSelf={member.userId === currentUserId}
                      compact={compact}
                      onOpen={() => setProfileFor(member.userId)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {profileFor ? (
        <UserProfileDialog userId={profileFor} open onClose={() => setProfileFor(null)} />
      ) : null}
    </aside>
  );
}

interface MemberRowProps {
  user: PublicUser;
  label: string;
  hint: string | null;
  colour: string | null;
  isOwner: boolean;
  compact: boolean;
  dimmed?: boolean;
  isSelf?: boolean;
  onOpen: () => void;
}

function MemberRow({
  user,
  label,
  hint,
  colour,
  isOwner,
  compact,
  dimmed,
  isSelf,
  onOpen,
}: MemberRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center gap-3 rounded px-2 text-left transition-colors',
        compact ? 'min-h-11 md:min-h-[42px]' : 'min-h-12',
        'hover:bg-surface-hover',
        dimmed && 'opacity-40 hover:opacity-100',
      )}
    >
      <Avatar user={user} size={32} showStatus ringColor="var(--bg-secondary)" />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1">
          <span
            className="truncate text-base font-medium"
            style={{ color: colour ?? 'var(--text-normal)' }}
          >
            {label}
          </span>
          {isSelf ? <span className="shrink-0 text-2xs text-text-faint">(you)</span> : null}
          {isOwner ? (
            <Crown size={13} className="shrink-0 text-warning" aria-label="Server owner" />
          ) : null}
        </span>
        {hint ? <span className="truncate text-xs text-text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}
