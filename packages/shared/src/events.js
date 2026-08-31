/**
 * Room names shared by the server (emit side) and the client (subscribe side).
 * Fan-out across API instances is handled by the socket.io Redis adapter.
 */
export const socketRooms = {
    user: (userId) => `user:${userId}`,
    server: (serverId) => `server:${serverId}`,
    channel: (channelId) => `channel:${channelId}`,
    conversation: (conversationId) => `dm:${conversationId}`,
};
//# sourceMappingURL=events.js.map