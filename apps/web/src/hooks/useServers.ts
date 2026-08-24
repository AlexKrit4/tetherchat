import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Ban,
  Channel,
  Invite,
  Role,
  ServerDetail,
  ServerMember,
  ServerSummary,
} from '@tetherchat/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useServers() {
  return useQuery({
    queryKey: queryKeys.servers,
    queryFn: () => api.get<ServerSummary[]>('/api/servers'),
    staleTime: 30_000,
  });
}

export function useServer(serverId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.server(serverId ?? 'none'),
    queryFn: () => api.get<ServerDetail>(`/api/servers/${serverId}`),
    enabled: Boolean(serverId) && serverId !== '@me',
    staleTime: 30_000,
  });
}

export function useMembers(serverId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.members(serverId ?? 'none'),
    queryFn: () => api.get<ServerMember[]>(`/api/servers/${serverId}/members`),
    enabled: Boolean(serverId) && serverId !== '@me',
    staleTime: 60_000,
  });
}

export function useCreateServer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<ServerDetail>('/api/servers', { name }),
    onSuccess: (server) => {
      client.setQueryData(queryKeys.server(server.id), server);
      void client.invalidateQueries({ queryKey: queryKeys.servers });
    },
  });
}

export function useJoinServer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<{ serverId: string }>(`/api/invite/${code}/join`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.servers });
    },
  });
}

export function useUpdateServer(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; description?: string | null }) =>
      api.patch<ServerSummary>(`/api/servers/${serverId}`, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.servers });
      void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
    },
  });
}

export function useUploadServerIcon(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<ServerSummary>(`/api/servers/${serverId}/icon`, form);
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
    mutationFn: (serverId: string) => api.delete(`/api/servers/${serverId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.servers }),
  });
}

export function useLeaveServer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (serverId: string) => api.post(`/api/servers/${serverId}/leave`),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.servers }),
  });
}

export function useCreateChannel(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; categoryId?: string | null; topic?: string | null }) =>
      api.post<Channel>(`/api/servers/${serverId}/channels`, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.server(serverId) }),
  });
}

export function useCreateCategory(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post(`/api/servers/${serverId}/categories`, { name }),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.server(serverId) }),
  });
}

export function useUpdateChannel(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      channelId,
      ...input
    }: {
      channelId: string;
      name?: string;
      topic?: string | null;
    }) => api.patch<Channel>(`/api/channels/${channelId}`, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.server(serverId) }),
  });
}

export function useDeleteChannel(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => api.delete(`/api/channels/${channelId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.server(serverId) }),
  });
}

export function useCreateInvite(serverId: string) {
  return useMutation({
    mutationFn: (input: { maxUses?: number | null; expiresInHours?: number | null } = {}) =>
      api.post<Invite>(`/api/servers/${serverId}/invite`, input),
  });
}

export function useRoles(serverId: string | undefined) {
  return useQuery({
    queryKey: ['roles', serverId],
    queryFn: () => api.get<Role[]>(`/api/servers/${serverId}/roles`),
    enabled: Boolean(serverId) && serverId !== '@me',
  });
}

export function useUpdateRole(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, ...input }: { roleId: string } & Partial<Role>) =>
      api.patch<Role>(`/api/servers/${serverId}/roles/${roleId}`, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
      void client.invalidateQueries({ queryKey: ['roles', serverId] });
    },
  });
}

export function useCreateRole(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; permissions?: number; color?: string | null }) =>
      api.post<Role>(`/api/servers/${serverId}/roles`, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
      void client.invalidateQueries({ queryKey: ['roles', serverId] });
    },
  });
}

export function useDeleteRole(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => api.delete(`/api/servers/${serverId}/roles/${roleId}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.server(serverId) });
      void client.invalidateQueries({ queryKey: ['roles', serverId] });
    },
  });
}

export function useUpdateMember(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      ...input
    }: {
      userId: string;
      nickname?: string | null;
      roleIds?: string[];
    }) => api.patch<ServerMember>(`/api/servers/${serverId}/members/${userId}`, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.members(serverId) }),
  });
}

export function useKickMember(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/api/servers/${serverId}/members/${userId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.members(serverId) }),
  });
}

export function useBanMember(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      api.put(`/api/servers/${serverId}/bans/${userId}`, { reason: reason ?? null }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.members(serverId) });
      void client.invalidateQueries({ queryKey: queryKeys.bans(serverId) });
    },
  });
}

export function useBans(serverId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bans(serverId ?? 'none'),
    queryFn: () => api.get<Ban[]>(`/api/servers/${serverId}/bans`),
    enabled: Boolean(serverId) && enabled,
  });
}

export function useUnbanMember(serverId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/api/servers/${serverId}/bans/${userId}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.bans(serverId) }),
  });
}
