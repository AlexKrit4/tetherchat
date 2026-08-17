import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { Ban, Crown, Trash2, Upload, UserMinus } from 'lucide-react';
import { LIMITS, PERMISSION_LABELS, PERMISSION_NAMES, Permission, can, hasFlag, togglePermission, } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { useBanMember, useBans, useCreateRole, useDeleteRole, useDeleteServer, useKickMember, useMembers, useUnbanMember, useUpdateMember, useUpdateRole, useUpdateServer, useUploadServerIcon, } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input, Textarea } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { serverInitials } from '@/components/layout/ServerRail';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
export function ServerSettingsDialog({ server, open, onClose }) {
    const [tab, setTab] = useState('overview');
    const currentUserId = useAuthStore((state) => state.user?.id);
    const isOwner = server.ownerId === currentUserId;
    const tabs = [
        { id: 'overview', label: 'Overview', visible: true },
        { id: 'roles', label: 'Roles', visible: can(server.permissions, Permission.MANAGE_ROLES) },
        { id: 'members', label: 'Members', visible: true },
        { id: 'bans', label: 'Bans', visible: can(server.permissions, Permission.BAN_MEMBERS) },
    ];
    return (_jsx(AdaptiveDialog, { open: open, onClose: onClose, title: `${server.name} settings`, width: "lg", children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("nav", { className: "scroller flex shrink-0 gap-1 overflow-x-auto pb-1", "aria-label": "Server settings sections", children: tabs
                        .filter((entry) => entry.visible)
                        .map((entry) => (_jsx("button", { type: "button", onClick: () => setTab(entry.id), className: cn('min-h-11 shrink-0 rounded px-3 text-base transition-colors md:min-h-8', tab === entry.id
                            ? 'bg-surface-selected text-text-heading'
                            : 'text-text-muted hover:bg-surface-hover hover:text-text'), children: entry.label }, entry.id))) }), tab === 'overview' ? _jsx(OverviewTab, { server: server, isOwner: isOwner, onClose: onClose }) : null, tab === 'roles' ? _jsx(RolesTab, { server: server }) : null, tab === 'members' ? _jsx(MembersTab, { server: server }) : null, tab === 'bans' ? _jsx(BansTab, { server: server }) : null] }) }));
}
function OverviewTab({ server, isOwner, onClose, }) {
    const update = useUpdateServer(server.id);
    const uploadIcon = useUploadServerIcon(server.id);
    const remove = useDeleteServer();
    const fileRef = useRef(null);
    const [name, setName] = useState(server.name);
    const [description, setDescription] = useState(server.description ?? '');
    const [confirm, setConfirm] = useState('');
    const canManage = can(server.permissions, Permission.MANAGE_SERVER);
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-base-tertiary text-xl font-semibold text-text", children: server.iconUrl ? (_jsx("img", { src: server.iconUrl, alt: "", className: "h-full w-full object-cover" })) : (serverInitials(server.name)) }), _jsxs("div", { children: [_jsxs(Button, { size: "sm", disabled: !canManage, loading: uploadIcon.isPending, onClick: () => fileRef.current?.click(), children: [_jsx(Upload, { size: 16, "aria-hidden": true }), "Change icon"] }), _jsx("p", { className: "mt-1 text-xs text-text-muted", children: "PNG, JPEG, GIF or WebP. Resized to 128px." }), _jsx("input", { ref: fileRef, type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", hidden: true, onChange: (event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                        uploadIcon.mutate(file, { onError: (error) => toast.error(errorMessage(error)) });
                                    }
                                    event.target.value = '';
                                } })] })] }), _jsx(Input, { label: "Server name", value: name, disabled: !canManage, maxLength: LIMITS.serverName.max, onChange: (event) => setName(event.target.value) }), _jsx(Textarea, { label: "Description", rows: 3, value: description, disabled: !canManage, maxLength: LIMITS.serverDescription.max, onChange: (event) => setDescription(event.target.value) }), _jsx(Button, { disabled: !canManage, loading: update.isPending, onClick: () => update.mutate({ name: name.trim(), description: description.trim() || null }, {
                    onSuccess: () => toast.success('Server updated'),
                    onError: (error) => toast.error(errorMessage(error)),
                }), children: "Save changes" }), isOwner ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "h-px bg-divider" }), _jsxs("div", { className: "flex flex-col gap-2 rounded-lg bg-[rgba(242,63,67,0.08)] p-3", children: [_jsx("p", { className: "text-base font-semibold text-text-heading", children: "Delete this server" }), _jsxs("p", { className: "text-sm text-text-muted", children: ["Every channel, message and member list is removed. Type ", _jsx("strong", { children: server.name }), ' ', "to confirm."] }), _jsx(Input, { value: confirm, placeholder: server.name, "aria-label": "Confirm server name", onChange: (event) => setConfirm(event.target.value) }), _jsxs(Button, { variant: "danger", disabled: confirm !== server.name, loading: remove.isPending, onClick: () => remove.mutate(server.id, {
                                    onSuccess: () => {
                                        onClose();
                                        toast.success('Server deleted');
                                    },
                                    onError: (error) => toast.error(errorMessage(error)),
                                }), children: [_jsx(Trash2, { size: 16, "aria-hidden": true }), "Delete server"] })] })] })) : null] }));
}
function RolesTab({ server }) {
    const createRole = useCreateRole(server.id);
    const updateRole = useUpdateRole(server.id);
    const deleteRole = useDeleteRole(server.id);
    const [selectedId, setSelectedId] = useState(server.roles[0]?.id ?? null);
    const [newName, setNewName] = useState('');
    const roles = [...server.roles].sort((a, b) => b.position - a.position);
    const selected = roles.find((role) => role.id === selectedId) ?? roles[0];
    return (_jsxs("div", { className: "flex flex-col gap-4 md:flex-row", children: [_jsxs("div", { className: "flex shrink-0 flex-col gap-2 md:w-[180px]", children: [_jsx("ul", { className: "flex flex-col gap-0.5", children: roles.map((role) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelectedId(role.id), className: cn('flex min-h-11 w-full items-center gap-2 rounded px-2 text-left text-base md:min-h-8', role.id === selected?.id
                                    ? 'bg-surface-selected text-text-heading'
                                    : 'text-text-muted hover:bg-surface-hover'), children: [_jsx("span", { "aria-hidden": true, className: "h-3 w-3 shrink-0 rounded-full", style: { background: role.color ?? 'var(--grey)' } }), _jsx("span", { className: "truncate", children: role.name })] }) }, role.id))) }), _jsxs("div", { className: "flex gap-1", children: [_jsx("input", { value: newName, placeholder: "New role", "aria-label": "New role name", onChange: (event) => setNewName(event.target.value), className: "h-10 min-w-0 flex-1 rounded bg-base-tertiary px-2 text-base text-text outline-none" }), _jsx(Button, { size: "sm", loading: createRole.isPending, onClick: () => {
                                    const name = newName.trim();
                                    if (!name)
                                        return;
                                    createRole.mutate({ name }, {
                                        onSuccess: (role) => {
                                            setNewName('');
                                            setSelectedId(role.id);
                                        },
                                        onError: (error) => toast.error(errorMessage(error)),
                                    });
                                }, children: "Add" })] })] }), selected ? _jsx(RoleEditor, { role: selected, server: server, onUpdate: updateRole, onDelete: deleteRole }) : null] }));
}
function RoleEditor({ role, server, onUpdate, onDelete, }) {
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
    return (_jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-4", children: [_jsx(Input, { label: "Role name", value: name, disabled: role.isDefault, maxLength: LIMITS.roleName.max, onChange: (event) => setName(event.target.value) }), _jsxs("div", { className: "flex items-center justify-between gap-3 rounded-lg bg-base-secondary p-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-base font-semibold text-text-heading", children: "Show separately" }), _jsx("p", { className: "text-sm text-text-muted", children: "Members with this role get their own member list section." })] }), _jsx(Toggle, { label: "Show separately", checked: hoist, onChange: setHoist, disabled: role.isDefault })] }), _jsxs("fieldset", { className: "flex flex-col gap-1", children: [_jsx("legend", { className: "pb-1 text-xs font-bold uppercase tracking-[0.02em] text-text-subheading", children: "Permissions" }), PERMISSION_NAMES.map((entry) => {
                        const bit = Permission[entry];
                        const disabled = !grantable.includes(entry);
                        return (_jsxs("label", { className: cn('flex min-h-11 items-center justify-between gap-3 rounded px-2 md:min-h-9', disabled ? 'opacity-40' : 'hover:bg-surface-hover'), children: [_jsx("span", { className: "text-base text-text", children: PERMISSION_LABELS[entry] }), _jsx(Toggle, { label: PERMISSION_LABELS[entry], disabled: disabled, checked: hasFlag(permissions, bit), onChange: () => setPermissions((current) => togglePermission(current, bit)) })] }, entry));
                    })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { loading: onUpdate.isPending, onClick: () => onUpdate.mutate({
                            roleId: role.id,
                            ...(role.isDefault ? {} : { name: name.trim(), hoist }),
                            permissions,
                        }, {
                            onSuccess: () => toast.success('Role saved'),
                            onError: (error) => toast.error(errorMessage(error)),
                        }), children: "Save role" }), !role.isDefault ? (_jsx(Button, { variant: "danger", loading: onDelete.isPending, onClick: () => onDelete.mutate(role.id, {
                            onSuccess: () => toast.success('Role deleted'),
                            onError: (error) => toast.error(errorMessage(error)),
                        }), children: "Delete role" })) : null] })] }));
}
function MembersTab({ server }) {
    const { data: members } = useMembers(server.id);
    const updateMember = useUpdateMember(server.id);
    const kick = useKickMember(server.id);
    const ban = useBanMember(server.id);
    const currentUserId = useAuthStore((state) => state.user?.id);
    const assignable = [...server.roles]
        .filter((role) => !role.isDefault)
        .sort((a, b) => b.position - a.position);
    return (_jsx("ul", { className: "flex flex-col gap-2", children: members?.map((member) => (_jsxs("li", { className: "rounded-lg bg-base-secondary p-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Avatar, { user: member.user, size: 36, showStatus: true, ringColor: "var(--bg-secondary)" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "flex items-center gap-1 truncate text-base font-medium text-text-heading", children: [member.nickname ?? member.user.displayName ?? member.user.username, member.userId === server.ownerId ? (_jsx(Crown, { size: 13, className: "text-warning", "aria-label": "Owner" })) : null] }), _jsxs("p", { className: "truncate text-sm text-text-muted", children: ["@", member.user.username] })] }), member.userId !== currentUserId && member.userId !== server.ownerId ? (_jsxs("div", { className: "flex shrink-0 gap-0.5", children: [can(server.permissions, Permission.KICK_MEMBERS) ? (_jsx(IconButton, { icon: UserMinus, label: "Kick member", onClick: () => kick.mutate(member.userId, {
                                        onSuccess: () => toast.success('Member removed'),
                                        onError: (error) => toast.error(errorMessage(error)),
                                    }) })) : null, can(server.permissions, Permission.BAN_MEMBERS) ? (_jsx(IconButton, { icon: Ban, label: "Ban member", tone: "danger", onClick: () => ban.mutate({ userId: member.userId }, {
                                        onSuccess: () => toast.success('Member banned'),
                                        onError: (error) => toast.error(errorMessage(error)),
                                    }) })) : null] })) : null] }), can(server.permissions, Permission.MANAGE_ROLES) && assignable.length > 0 ? (_jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: assignable.map((role) => {
                        const active = member.roleIds.includes(role.id);
                        return (_jsxs("button", { type: "button", onClick: () => updateMember.mutate({
                                userId: member.userId,
                                roleIds: active
                                    ? member.roleIds.filter((id) => id !== role.id)
                                    : [...member.roleIds, role.id],
                            }, { onError: (error) => toast.error(errorMessage(error)) }), className: cn('flex min-h-8 items-center gap-1.5 rounded px-2 text-sm transition-colors', active
                                ? 'bg-surface-active text-text-heading'
                                : 'bg-base-tertiary text-text-muted hover:text-text'), children: [_jsx("span", { "aria-hidden": true, className: "h-2.5 w-2.5 rounded-full", style: { background: role.color ?? 'var(--grey)' } }), role.name] }, role.id));
                    }) })) : null] }, member.userId))) }));
}
function BansTab({ server }) {
    const { data: bans } = useBans(server.id, true);
    const unban = useUnbanMember(server.id);
    if (!bans || bans.length === 0) {
        return _jsx("p", { className: "py-6 text-center text-base text-text-muted", children: "Nobody is banned." });
    }
    return (_jsx("ul", { className: "flex flex-col gap-2", children: bans.map((entry) => (_jsxs("li", { className: "flex items-center gap-3 rounded-lg bg-base-secondary p-3", children: [_jsx(Avatar, { user: entry.user, size: 32 }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "truncate text-base text-text-heading", children: ["@", entry.user.username] }), entry.reason ? (_jsx("p", { className: "truncate text-sm text-text-muted", children: entry.reason })) : null] }), _jsx(Button, { size: "sm", variant: "secondary", onClick: () => unban.mutate(entry.userId, {
                        onSuccess: () => toast.success('Ban lifted'),
                        onError: (error) => toast.error(errorMessage(error)),
                    }), children: "Revoke" })] }, entry.userId))) }));
}
//# sourceMappingURL=ServerSettingsDialog.js.map