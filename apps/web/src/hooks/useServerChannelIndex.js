import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServers } from './useServers';
/**
 * Maps server id to its channel ids using whatever server detail is already
 * cached. The rail needs this to roll channel unread state up into a server
 * badge without issuing a request per server.
 */
export function useServerChannelIndex() {
    const client = useQueryClient();
    const { data: servers } = useServers();
    return useMemo(() => {
        const index = {};
        for (const server of servers ?? []) {
            const detail = client.getQueryData(['server', server.id]);
            index[server.id] = detail?.channels.map((channel) => channel.id) ?? [];
        }
        return index;
    }, [client, servers]);
}
//# sourceMappingURL=useServerChannelIndex.js.map