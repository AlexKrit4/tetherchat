import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
export function useServers() {
    return useQuery({
        queryKey: queryKeys.servers,
        queryFn: () => api.get('/api/servers'),
        staleTime: 30_000,
    });
}
export function useServer(serverId) {
    return useQuery({
        queryKey: queryKeys.server(serverId ?? 'none'),
        queryFn: () => api.get(`/api/servers/${serverId}`),
        enabled: Boolean(serverId) && serverId !== '@me',
        staleTime: 30_000,
    });
}
export function useMembers(serverId) {
    return useQuery({
        queryKey: queryKeys.members(serverId ?? 'none'),
        queryFn: () => api.get(`/api/servers/${serverId}/members`),
        enabled: Boolean(serverId) && serverId !== '@me',
        staleTime: 60_000,
    });
}
export function useCreateServer() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (name) => api.post('/api/servers', { name }),
        onSuccess: (server) => {
            client.setQueryData(queryKeys.server(server.id), server);
            void client.invalidateQueries({ queryKey: queryKeys.servers });
        },
    });
}
export function useJoinServer() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (code) => api.post(`/api/invite/${code}/join`),
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: queryKeys.servers });
        },
    });
}
export function useUpdateServer(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (input) => api.patch(`/api/servers/${serverId}`, input),
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: queryKeys.servers });
            void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
        },
    });
}
export function useUploadServerIcon(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (file) => {
            const form = new FormData();
            form.append('file', file);
            return api.post(`/api/servers/${serverId}/icon`, form);
        },
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: queryKeys.servers });
            void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
        },
    });
}
export function useDeleteServer() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (serverId) => api.delete(`/api/servers/${serverId}`),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.servers }),
    });
}
export function useLeaveServer() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (serverId) => api.post(`/api/servers/${serverId}/leave`),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.servers }),
    });
}
export function useCreateChannel(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (input) => api.post(`/api/servers/${serverId}/channels`, input),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.server(serverId) }),
    });
}
export function useCreateCategory(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (name) => api.post(`/api/servers/${serverId}/categories`, { name }),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.server(serverId) }),
    });
}
export function useUpdateChannel(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ channelId, ...input }) => api.patch(`/api/channels/${channelId}`, input),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.server(serverId) }),
    });
}
export function useDeleteChannel(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (channelId) => api.delete(`/api/channels/${channelId}`),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.server(serverId) }),
    });
}
export function useCreateInvite(serverId) {
    return useMutation({
        mutationFn: (input = {}) => api.post(`/api/servers/${serverId}/invite`, input),
    });
}
export function useRoles(serverId) {
    return useQuery({
        queryKey: ['roles', serverId],
        queryFn: () => api.get(`/api/servers/${serverId}/roles`),
        enabled: Boolean(serverId) && serverId !== '@me',
    });
}
export function useUpdateRole(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ roleId, ...input }) => api.patch(`/api/servers/${serverId}/roles/${roleId}`, input),
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
            void client.invalidateQueries({ queryKey: ['roles', serverId] });
        },
    });
}
export function useCreateRole(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (input) => api.post(`/api/servers/${serverId}/roles`, input),
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
            void client.invalidateQueries({ queryKey: ['roles', serverId] });
        },
    });
}
export function useDeleteRole(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (roleId) => api.delete(`/api/servers/${serverId}/roles/${roleId}`),
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
            void client.invalidateQueries({ queryKey: ['roles', serverId] });
        },
    });
}
export function useUpdateMember(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, ...input }) => api.patch(`/api/servers/${serverId}/members/${userId}`, input),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.members(serverId) }),
    });
}
export function useKickMember(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (userId) => api.delete(`/api/servers/${serverId}/members/${userId}`),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.members(serverId) }),
    });
}
export function useBanMember(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, reason }) => api.put(`/api/servers/${serverId}/bans/${userId}`, { reason: reason ?? null }),
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: queryKeys.members(serverId) });
            void client.invalidateQueries({ queryKey: queryKeys.bans(serverId) });
        },
    });
}
export function useBans(serverId, enabled) {
    return useQuery({
        queryKey: queryKeys.bans(serverId ?? 'none'),
        queryFn: () => api.get(`/api/servers/${serverId}/bans`),
        enabled: Boolean(serverId) && enabled,
    });
}
export function useUnbanMember(serverId) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (userId) => api.delete(`/api/servers/${serverId}/bans/${userId}`),
        onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.bans(serverId) }),
    });
}
//# sourceMappingURL=useServers.js.map