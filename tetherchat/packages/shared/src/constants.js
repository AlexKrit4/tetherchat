export const LIMITS = {
    username: { min: 2, max: 32 },
    displayName: { max: 32 },
    password: { min: 8, max: 128 },
    serverName: { min: 2, max: 64 },
    channelName: { min: 1, max: 64 },
    categoryName: { min: 1, max: 64 },
    roleName: { min: 1, max: 32 },
    messageContent: { max: 4000 },
    channelTopic: { max: 512 },
    serverDescription: { max: 512 },
    customStatus: { max: 128 },
    bio: { max: 256 },
    attachmentBytes: 10 * 1024 * 1024,
    avatarBytes: 8 * 1024 * 1024,
    attachmentsPerMessage: 5,
    groupDmMembers: 10,
    messagePageSize: 50,
};
/** Consecutive messages by the same author collapse into one group inside this window. */
export const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;
export const TYPING_TIMEOUT_MS = 8_000;
export const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
export const PRESENCE_STATUSES = ['online', 'idle', 'dnd', 'invisible', 'offline'];
export const NOTIFICATION_LEVELS = ['all', 'mentions', 'nothing'];
export const ROLE_COLORS = [
    '#1abc9c',
    '#2ecc71',
    '#3498db',
    '#9b59b6',
    '#e91e63',
    '#f1c40f',
    '#e67e22',
    '#e74c3c',
    '#95a5a6',
    '#607d8b',
];
export const DEFAULT_ROLE_NAME = '@everyone';
export const ALLOWED_ATTACHMENT_MIME = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'application/pdf',
    'text/plain',
    'application/zip',
];
export const ALLOWED_AVATAR_MIME = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
];
export function isImageMime(mime) {
    return mime.startsWith('image/');
}
export function isVideoMime(mime) {
    return mime.startsWith('video/');
}
export function isAudioMime(mime) {
    return mime.startsWith('audio/');
}
//# sourceMappingURL=constants.js.map