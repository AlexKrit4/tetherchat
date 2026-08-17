export const queryKeys = {
    me: ['me'],
    servers: ['servers'],
    server: (serverId) => ['server', serverId],
    members: (serverId) => ['members', serverId],
    bans: (serverId) => ['bans', serverId],
    invites: (serverId) => ['invites', serverId],
    messages: (channelId) => ['messages', channelId],
    pins: (channelId) => ['pins', channelId],
    search: (channelId, query) => ['search', channelId, query],
    readStates: ['read-states'],
    dms: ['dms'],
    dm: (conversationId) => ['dm', conversationId],
    channelNotifications: (channelId) => ['channel-notifications', channelId],
    userSearch: (query) => ['user-search', query],
    invitePreview: (code) => ['invite-preview', code],
};
//# sourceMappingURL=queryKeys.js.map