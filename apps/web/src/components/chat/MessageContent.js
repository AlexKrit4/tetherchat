import { jsx as _jsx } from "react/jsx-runtime";
import { Fragment, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { tokenizeMentions } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useMembers } from '@/hooks/useServers';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
/**
 * Renders message markdown. Mentions are resolved from the member cache before
 * markdown runs so a rename shows up everywhere without rewriting history, and
 * raw HTML stays disabled (react-markdown's default) to keep content inert.
 */
export function MessageContent({ content, className }) {
    const { server, serverId } = useChatTarget();
    const { data: members } = useMembers(serverId);
    const currentUserId = useAuthStore((state) => state.user?.id);
    const navigate = useNavigate();
    const memberIndex = useMemo(() => {
        const index = new Map();
        for (const member of members ?? [])
            index.set(member.userId, member);
        return index;
    }, [members]);
    const tokens = useMemo(() => tokenizeMentions(content), [content]);
    return (_jsx("div", { className: cn('md-content text-message text-text md:text-message', className), children: tokens.map((token, index) => {
            if (token.type === 'text') {
                return (_jsx(Markdown, { remarkPlugins: [remarkGfm], components: {
                        a: ({ href, children }) => (_jsx("a", { href: href, target: "_blank", rel: "noopener noreferrer nofollow", children: children })),
                        // Images inside message text are shown as links; real media
                        // arrives as an attachment, which has its own renderer.
                        img: ({ src, alt }) => (_jsx("a", { href: typeof src === 'string' ? src : '#', target: "_blank", rel: "noopener noreferrer", children: alt || src })),
                    }, children: token.value }, index));
            }
            if (token.type === 'user') {
                const member = memberIndex.get(token.id);
                const name = member?.nickname ?? member?.user.displayName ?? member?.user.username;
                return (_jsx(MentionChip, { highlighted: token.id === currentUserId, label: `@${name ?? 'unknown'}` }, index));
            }
            if (token.type === 'channel') {
                const channel = server?.channels.find((entry) => entry.id === token.id);
                return (_jsx(MentionChip, { label: `#${channel?.name ?? 'unknown'}`, onClick: channel && serverId
                        ? () => navigate(`/channels/${serverId}/${channel.id}`)
                        : undefined }, index));
            }
            return _jsx(MentionChip, { label: "@everyone", highlighted: true }, index);
        }) }));
}
function MentionChip({ label, highlighted, onClick, }) {
    return (_jsx(Fragment, { children: _jsx("button", { type: "button", onClick: onClick, disabled: !onClick, className: cn('rounded px-0.5 font-medium transition-colors', highlighted
                ? 'bg-[rgba(88,101,242,0.3)] text-[#dee0fc] hover:bg-brand hover:text-white'
                : 'bg-[rgba(88,101,242,0.15)] text-[#c9cdfb] hover:bg-brand hover:text-white', !onClick && 'cursor-default'), children: label }) }));
}
//# sourceMappingURL=MessageContent.js.map