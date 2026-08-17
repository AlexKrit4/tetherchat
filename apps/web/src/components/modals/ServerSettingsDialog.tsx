import { useRef, useState } from 'react';
import { Ban, Crown, Trash2, Upload, UserMinus } from 'lucide-react';
import {
  LIMITS,
  PERMISSION_LABELS,
  PERMISSION_NAMES,
  Permission,
  can,
  hasFlag,
  togglePermission,
} from '@tetherchat/shared';
import type { Role, ServerDetail } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import {
  useBanMember,
  useBans,
  useCreateRole,
  useDeleteRole,
  useDeleteServer,
  useKickMember,
  useMembers,
  useUnbanMember,
  useUpdateMember,
  useUpdateRole,
  useUpdateServer,
  useUploadServerIcon,
} from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input, Textarea } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { serverInitials } from '@/components/layout/ServerRail';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

type Tab = 'overview' | 'roles' | 'members' | 'bans';

export interface ServerSettingsDialogProps {
  server: ServerDetail;
  open: boolean;
  onClose: () => void;
}

export function ServerSettingsDialog({ server, open, onClose }: ServerSettingsDialogProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isOwner = server.ownerId === currentUserId;

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'overview', label: 'Overview', visible: true },
    { id: 'roles', label: 'Roles', visible: can(server.permissions, Permission.MANAGE_ROLES) },
    { id: 'members', label: 'Members', visible: true },
    { id: 'bans', label: 'Bans', visible: can(server.permissions, Permission.BAN_MEMBERS) },
  ];

  return (
    <AdaptiveDialog open={open} onClose={onClose} title={`${server.name} settings`} width="lg">
      <div className="flex flex-col gap-4">
        <nav
          className="scroller flex shrink-0 gap-1 overflow-x-auto pb-1"
          aria-label="Server settings sections"
        >
          {tabs
            .filter((entry) => entry.visible)
            .map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={cn(
                  'min-h-11 shrink-0 rounded px-3 text-base transition-colors md:min-h-8',
                  tab === entry.id
                    ? 'bg-surface-selected text-text-heading'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text',
                )}
              >
                {entry.label}
              </button>
            ))}
        </nav>

        {tab === 'overview' ? <OverviewTab server={server} isOwner={isOwner} onClose={onClose} /> : null}
        {tab === 'roles' ? <RolesTab server={server} /> : null}
        {tab === 'members' ? <MembersTab server={server} /> : null}
        {tab === 'bans' ? <BansTab server={server} /> : null}
      </div>
    </AdaptiveDialog>
  );
}

function OverviewTab({
  server,
  isOwner,
  onClose,
}: {
  server: ServerDetail;
  isOwner: boolean;
  onClose: () => void;
}) {
  const update = useUpdateServer(server.id);
  const uploadIcon = useUploadServerIcon(server.id);
  const remove = useDeleteServer();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description ?? '');
  const [confirm, setConfirm] = useState('');

  const canManage = can(server.permissions, Permission.MANAGE_SERVER);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-tertiary text-xl font-semibold text-text">
          {server.iconUrl ? (
            <img src={server.iconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            serverInitials(server.name)
          )}
        </span>
        <div>
          <Button
            size="sm"
            disabled={!canManage}
            loading={uploadIcon.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} aria-hidden />
            Change icon
          </Button>
          <p className="mt-1 text-xs text-text-muted">PNG, JPEG, GIF or WebP. Resized to 128px.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                uploadIcon.mutate(file, { onError: (error) => toast.error(errorMessage(error)) });
              }
              event.target.value = '';
            }}
          />
        </div>
      </div>

      <Input
        label="Server name"
        value={name}
        disabled={!canManage}
        maxLength={LIMITS.serverName.max}
        onChange={(event) => setName(event.target.value)}
      />

      <Textarea
        label="Description"
        rows={3}
        value={description}
        disabled={!canManage}
        maxLength={LIMITS.serverDescription.max}
        onChange={(event) => setDescription(event.target.value)}
      />

      <Button
        disabled={!canManage}
        loading={update.isPending}
        onClick={() =>
          update.mutate(
            { name: name.trim(), description: description.trim() || null },
            {
              onSuccess: () => toast.success('Server updated'),
              onError: (error) => toast.error(errorMessage(error)),
            },
          )
        }
      >
        Save changes
      </Button>

      {isOwner ? (
        <>
          <div className="h-px bg-divider" />
          <div className="flex flex-col gap-2 rounded-lg bg-[rgba(242,63,67,0.08)] p-3">
            <p className="text-base font-semibold text-text-heading">Delete this server</p>
            <p className="text-sm text-text-muted">
              Every channel, message and member list is removed. Type <strong>{server.name}</strong>{' '}
              to confirm.
            </p>
            <Input
              value={confirm}
              placeholder={server.name}
              aria-label="Confirm server name"
              onChange={(event) => setConfirm(event.target.value)}
            />
            <Button
              variant="danger"
              disabled={confirm !== server.name}
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(server.id, {
                  onSuccess: () => {
                    onClose();
                    toast.success('Server deleted');
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              <Trash2 size={16} aria-hidden />
              Delete server
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RolesTab({ server }: { server: ServerDetail }) {
  const createRole = useCreateRole(server.id);
  const updateRole = useUpdateRole(server.id);
  const deleteRole = useDeleteRole(server.id);
  const [selectedId, setSelectedId] = useState(server.roles[0]?.id ?? null);
  const [newName, setNewName] = useState('');

  const roles = [...server.roles].sort((a, b) => b.position - a.position);
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0];

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex shrink-0 flex-col gap-2 md:w-[180px]">
        <ul className="flex flex-col gap-0.5">
          {roles.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                onClick={() => setSelectedId(role.id)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded px-2 text-left text-base md:min-h-8',
                  role.id === selected?.id
                    ? 'bg-surface-selected text-text-heading'
                    : 'text-text-muted hover:bg-surface-hover',
                )}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: role.color ?? 'var(--grey)' }}
                />
                <span className="truncate">{role.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-1">
          <input
            value={newName}
            placeholder="New role"
            aria-label="New role name"
            onChange={(event) => setNewName(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded bg-surface-tertiary px-2 text-base text-text outline-none"
          />
          <Button
            size="sm"
            loading={createRole.isPending}
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              createRole.mutate(
                { name },
                {
                  onSuccess: (role) => {
                    setNewName('');
                    setSelectedId(role.id);
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              );
            }}
          >
            Add
          </Button>
        </div>
      </div>

      {selected ? <RoleEditor role={selected} server={server} onUpdate={updateRole} onDelete={deleteRole} /> : null}
    </div>
  );
}

function RoleEditor({
  role,
  server,
  onUpdate,
  onDelete,
}: {
  role: Role;
  server: ServerDetail;
  onUpdate: ReturnType<typeof useUpdateRole>;
  onDelete: ReturnType<typeof useDeleteRole>;
}) {
  const [name, setName] = useState(role.name);
  const [permissions, setPermissions] = useState(role.permissions);
  const [hoist, setHoist] = useState(role.hoist);

  // Re-sync when the selected role changes.
  const [trackedId, setTrackedId] = useState(role.id);
  if (trackedId !== role.id) {
    setTrackedId(role.id);
    setName(role.name);
    setPermissions(role.permissions);
    setHoist(role.hoist);
  }

  const grantable = can(server.permissions, Permission.ADMINISTRATOR)
    ? PERMISSION_NAMES
    : PERMISSION_NAMES.filter((entry) => hasFlag(server.permissions, Permission[entry]));

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <Input
        label="Role name"
        value={name}
        disabled={role.isDefault}
        maxLength={LIMITS.roleName.max}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-secondary p-3">
        <div>
          <p className="text-base font-semibold text-text-heading">Show separately</p>
          <p className="text-sm text-text-muted">
            Members with this role get their own member list section.
          </p>
        </div>
        <Toggle label="Show separately" checked={hoist} onChange={setHoist} disabled={role.isDefault} />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="pb-1 text-xs font-bold uppercase tracking-[0.02em] text-text-subheading">
          Permissions
        </legend>
        {PERMISSION_NAMES.map((entry) => {
          const bit = Permission[entry];
          const disabled = !grantable.includes(entry);
          return (
            <label
              key={entry}
              className={cn(
                'flex min-h-11 items-center justify-between gap-3 rounded px-2 md:min-h-9',
                disabled ? 'opacity-40' : 'hover:bg-surface-hover',
              )}
            >
              <span className="text-base text-text">{PERMISSION_LABELS[entry]}</span>
              <Toggle
                label={PERMISSION_LABELS[entry]}
                disabled={disabled}
                checked={hasFlag(permissions, bit)}
                onChange={() => setPermissions((current) => togglePermission(current, bit))}
              />
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button
          loading={onUpdate.isPending}
          onClick={() =>
            onUpdate.mutate(
              {
                roleId: role.id,
                ...(role.isDefault ? {} : { name: name.trim(), hoist }),
                permissions,
              },
              {
                onSuccess: () => toast.success('Role saved'),
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
        >
          Save role
        </Button>

        {!role.isDefault ? (
          <Button
            variant="danger"
            loading={onDelete.isPending}
            onClick={() =>
              onDelete.mutate(role.id, {
                onSuccess: () => toast.success('Role deleted'),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            Delete role
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MembersTab({ server }: { server: ServerDetail }) {
  const { data: members } = useMembers(server.id);
  const updateMember = useUpdateMember(server.id);
  const kick = useKickMember(server.id);
  const ban = useBanMember(server.id);
  const currentUserId = useAuthStore((state) => state.user?.id);

  const assignable = [...server.roles]
    .filter((role) => !role.isDefault)
    .sort((a, b) => b.position - a.position);

  return (
    <ul className="flex flex-col gap-2">
      {members?.map((member) => (
        <li key={member.userId} className="rounded-lg bg-surface-secondary p-3">
          <div className="flex items-center gap-3">
            <Avatar user={member.user} size={36} showStatus ringColor="var(--bg-secondary)" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-base font-medium text-text-heading">
                {member.nickname ?? member.user.displayName ?? member.user.username}
                {member.userId === server.ownerId ? (
                  <Crown size={13} className="text-warning" aria-label="Owner" />
                ) : null}
              </p>
              <p className="truncate text-sm text-text-muted">@{member.user.username}</p>
            </div>

            {member.userId !== currentUserId && member.userId !== server.ownerId ? (
              <div className="flex shrink-0 gap-0.5">
                {can(server.permissions, Permission.KICK_MEMBERS) ? (
                  <IconButton
                    icon={UserMinus}
                    label="Kick member"
                    onClick={() =>
                      kick.mutate(member.userId, {
                        onSuccess: () => toast.success('Member removed'),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                  />
                ) : null}
                {can(server.permissions, Permission.BAN_MEMBERS) ? (
                  <IconButton
                    icon={Ban}
                    label="Ban member"
                    tone="danger"
                    onClick={() =>
                      ban.mutate(
                        { userId: member.userId },
                        {
                          onSuccess: () => toast.success('Member banned'),
                          onError: (error) => toast.error(errorMessage(error)),
                        },
                      )
                    }
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {can(server.permissions, Permission.MANAGE_ROLES) && assignable.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {assignable.map((role) => {
                const active = member.roleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                      updateMember.mutate(
                        {
                          userId: member.userId,
                          roleIds: active
                            ? member.roleIds.filter((id) => id !== role.id)
                            : [...member.roleIds, role.id],
                        },
                        { onError: (error) => toast.error(errorMessage(error)) },
                      )
                    }
                    className={cn(
                      'flex min-h-8 items-center gap-1.5 rounded px-2 text-sm transition-colors',
                      active
                        ? 'bg-surface-active text-text-heading'
                        : 'bg-surface-tertiary text-text-muted hover:text-text',
                    )}
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: role.color ?? 'var(--grey)' }}
                    />
                    {role.name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function BansTab({ server }: { server: ServerDetail }) {
  const { data: bans } = useBans(server.id, true);
  const unban = useUnbanMember(server.id);

  if (!bans || bans.length === 0) {
    return <p className="py-6 text-center text-base text-text-muted">Nobody is banned.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {bans.map((entry) => (
        <li key={entry.userId} className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3">
          <Avatar user={entry.user} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base text-text-heading">@{entry.user.username}</p>
            {entry.reason ? (
              <p className="truncate text-sm text-text-muted">{entry.reason}</p>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              unban.mutate(entry.userId, {
                onSuccess: () => toast.success('Ban lifted'),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            Revoke
          </Button>
        </li>
      ))}
    </ul>
  );
}
