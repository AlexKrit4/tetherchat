import { Fragment, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { tokenizeMentions } from '@tetherchat/shared';
import type { ServerMember } from '@tetherchat/shared';
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
export function MessageContent({ content, className }: { content: string; className?: string }) {
  const { server, serverId } = useChatTarget();
  const { data: members } = useMembers(serverId);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const navigate = useNavigate();

  const memberIndex = useMemo(() => {
    const index = new Map<string, ServerMember>();
    for (const member of members ?? []) index.set(member.userId, member);
    return index;
  }, [members]);

  const tokens = useMemo(() => tokenizeMentions(content), [content]);

  return (
    <div className={cn('md-content text-message text-text md:text-message', className)}>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return (
            <Markdown
              key={index}
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                    {children}
                  </a>
                ),
                // Images inside message text are shown as links; real media
                // arrives as an attachment, which has its own renderer.
                img: ({ src, alt }) => (
                  <a href={typeof src === 'string' ? src : '#'} target="_blank" rel="noopener noreferrer">
                    {alt || src}
                  </a>
                ),
              }}
            >
              {token.value}
            </Markdown>
          );
        }

        if (token.type === 'user') {
          const member = memberIndex.get(token.id);
          const name = member?.nickname ?? member?.user.displayName ?? member?.user.username;
          return (
            <MentionChip
              key={index}
              highlighted={token.id === currentUserId}
              label={`@${name ?? 'unknown'}`}
            />
          );
        }

        if (token.type === 'channel') {
          const channel = server?.channels.find((entry) => entry.id === token.id);
          return (
            <MentionChip
              key={index}
              label={`#${channel?.name ?? 'unknown'}`}
              onClick={
                channel && serverId
                  ? () => navigate(`/channels/${serverId}/${channel.id}`)
                  : undefined
              }
            />
          );
        }

        return <MentionChip key={index} label="@everyone" highlighted />;
      })}
    </div>
  );
}

function MentionChip({
  label,
  highlighted,
  onClick,
}: {
  label: string;
  highlighted?: boolean;
  onClick?: () => void;
}) {
  return (
    <Fragment>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          'rounded px-0.5 font-medium transition-colors',
          highlighted
            ? 'bg-[rgba(88,101,242,0.3)] text-[#dee0fc] hover:bg-brand hover:text-white'
            : 'bg-[rgba(88,101,242,0.15)] text-[#c9cdfb] hover:bg-brand hover:text-white',
          !onClick && 'cursor-default',
        )}
      >
        {label}
      </button>
    </Fragment>
  );
}
