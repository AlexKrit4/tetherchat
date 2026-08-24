/**
 * Permission bitmask. Values are stable — never renumber an existing flag,
 * stored role rows in the database reference these bit positions directly.
 */
export const Permission = {
    VIEW_CHANNEL: 1 << 0,
    SEND_MESSAGES: 1 << 1,
    MANAGE_MESSAGES: 1 << 2,
    MANAGE_CHANNELS: 1 << 3,
    MANAGE_ROLES: 1 << 4,
    MANAGE_SERVER: 1 << 5,
    KICK_MEMBERS: 1 << 6,
    BAN_MEMBERS: 1 << 7,
    CREATE_INVITE: 1 << 8,
    ATTACH_FILES: 1 << 9,
    ADD_REACTIONS: 1 << 10,
    MENTION_EVERYONE: 1 << 11,
    ADMINISTRATOR: 1 << 12,
};
export const PERMISSION_NAMES = Object.keys(Permission);
export const DEFAULT_PERMISSIONS = Permission.VIEW_CHANNEL |
    Permission.SEND_MESSAGES |
    Permission.CREATE_INVITE |
    Permission.ATTACH_FILES |
    Permission.ADD_REACTIONS;
export const ALL_PERMISSIONS = PERMISSION_NAMES.reduce((acc, name) => acc | Permission[name], 0);
export const MODERATOR_PERMISSIONS = DEFAULT_PERMISSIONS |
    Permission.MANAGE_MESSAGES |
    Permission.KICK_MEMBERS |
    Permission.MENTION_EVERYONE;
/** Combine role bitmasks. ADMINISTRATOR implies every other permission. */
export function combinePermissions(masks) {
    const combined = masks.reduce((acc, mask) => acc | mask, 0);
    return hasFlag(combined, Permission.ADMINISTRATOR) ? ALL_PERMISSIONS : combined;
}
export function hasFlag(mask, flag) {
    return (mask & flag) === flag;
}
/**
 * Resolve the effective permissions of a member.
 * Server owners always hold every permission, regardless of role assignment.
 */
export function resolvePermissions(input) {
    if (input.isOwner)
        return ALL_PERMISSIONS;
    const base = combinePermissions(input.roleMasks);
    if (hasFlag(base, Permission.ADMINISTRATOR))
        return ALL_PERMISSIONS;
    const allowed = base | (input.channelAllow ?? 0);
    return allowed & ~(input.channelDeny ?? 0);
}
export function can(mask, permission) {
    return hasFlag(mask, Permission.ADMINISTRATOR) || hasFlag(mask, permission);
}
export function listPermissions(mask) {
    return PERMISSION_NAMES.filter((name) => hasFlag(mask, Permission[name]));
}
export function togglePermission(mask, permission) {
    return hasFlag(mask, permission) ? mask & ~permission : mask | permission;
}
export const PERMISSION_LABELS = {
    VIEW_CHANNEL: 'View Channels',
    SEND_MESSAGES: 'Send Messages',
    MANAGE_MESSAGES: 'Manage Messages',
    MANAGE_CHANNELS: 'Manage Channels',
    MANAGE_ROLES: 'Manage Roles',
    MANAGE_SERVER: 'Manage Server',
    KICK_MEMBERS: 'Kick Members',
    BAN_MEMBERS: 'Ban Members',
    CREATE_INVITE: 'Create Invite',
    ATTACH_FILES: 'Attach Files',
    ADD_REACTIONS: 'Add Reactions',
    MENTION_EVERYONE: 'Mention @everyone',
    ADMINISTRATOR: 'Administrator',
};
//# sourceMappingURL=permissions.js.map