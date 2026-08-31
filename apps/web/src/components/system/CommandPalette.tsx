import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  Compass,
  Hash,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ServerDetail } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { fuzzyMatch } from '@/lib/fuzzy';
import { queryKeys } from '@/lib/queryKeys';
import { useT } from '@/i18n/useT';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { useServers } from '@/hooks/useServers';
import { conversationTitle, useConversations, useCreateConversation } from '@/hooks/useDms';
import { useFriends } from '@/hooks/useFriends';
import { CreateServerDialog } from '@/components/modals/CreateServerDialog';
import { JoinServerDialog } from '@/components/modals/JoinServerDialog';
import { UserSettingsDialog } from '@/components/modals/UserSettingsDialog';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

type ItemKind = 'server' | 'channel' | 'conversation' | 'friend' | 'action';

type PaletteDialog = 'create-server' | 'join-server' | 'user-settings' | null;

interface PaletteItem {
  id: string;
  kind: ItemKind;
  label: string;
  /** Server name for a channel, username for a person. */
  detail?: string;
  icon: LucideIcon;
  run: () => void;
}

const SECTION_ORDER: ItemKind[] = ['channel', 'conversation', 'server', 'friend', 'action'];

const SECTION_LABEL: Record<ItemKind, string> = {
  channel: 'palette.channels',
  conversation: 'palette.conversations',
  server: 'palette.servers',
  friend: 'palette.friends',
  action: 'palette.actions',
};

/**
 * Cmd+K switcher, in the shape Linear made standard: one field, results grouped
 * by kind, arrows and Enter, no mouse required.
 *
 * Everything it lists is already in the React Query cache, so opening it costs
 * no requests and it stays useful offline. Channels come from whichever server
 * details have been fetched — a server the reader has not opened this session
 * contributes only itself, which is the same information the sidebar has.
 */
export function CommandPalette() {
  const t = useT();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  // The palette opens these itself rather than signalling another component,
  // which would mean a store field that exists only to be a message channel.
  const [dialog, setDialog] = useState<PaletteDialog>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: servers } = useServers();
  const { data: conversations } = useConversations();
  const { data: friends } = useFriends();
  const createConversation = useCreateConversation();
  const setFriendsOpen = useUiStore((state) => state.setFriendsRailOpen);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K as well as Cmd+K: on Windows and Linux browsers Cmd is not
      // available, and Firefox binds Ctrl+K to its own search bar, so the
      // default has to be suppressed for the app binding to survive.
      const combo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!combo) return;
      event.preventDefault();
      setOpen((current) => !current);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    if (!open) return [];

    const result: PaletteItem[] = [];

    for (const server of servers ?? []) {
      result.push({
        id: `server:${server.id}`,
        kind: 'server',
        label: server.name,
        icon: Users,
        run: () => {
          setFriendsOpen(false);
          navigate(`/channels/${server.id}`);
        },
      });

      const detail = client.getQueryData<ServerDetail>(queryKeys.server(server.id));
      for (const channel of detail?.channels ?? []) {
        result.push({
          id: `channel:${channel.id}`,
          kind: 'channel',
          label: channel.name,
          detail: server.name,
          icon: Hash,
          run: () => {
            setFriendsOpen(false);
            navigate(`/channels/${server.id}/${channel.id}`);
          },
        });
      }
    }

    for (const conversation of conversations ?? []) {
      result.push({
        id: `dm:${conversation.id}`,
        kind: 'conversation',
        label: conversationTitle(
          conversation,
          currentUserId,
          t('dm.savedMessages'),
          t('dm.aiChat'),
          t('dm.vpnChat'),
        ),
        icon: conversation.isSaved
          ? Bookmark
          : conversation.isAi
            ? Sparkles
            : conversation.isVpn
              ? Shield
              : conversation.isGroup
                ? Users
                : Search,
        run: () => {
          setFriendsOpen(false);
          navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
        },
      });
    }

    // A friend without an open conversation still needs to be reachable, so
    // selecting one opens the existing thread or creates it.
    const conversationPeers = new Set(
      (conversations ?? [])
        .filter((conversation) => !conversation.isGroup)
        .flatMap((conversation) => conversation.members.map((member) => member.id)),
    );

    for (const friend of friends ?? []) {
      if (conversationPeers.has(friend.id)) continue;
      result.push({
        id: `friend:${friend.id}`,
        kind: 'friend',
        label: friend.displayName ?? friend.username,
        detail: `@${friend.username}`,
        icon: UserPlus,
        run: () => {
          createConversation.mutate(
            { userIds: [friend.id] },
            {
              onSuccess: (conversation) => {
                setFriendsOpen(false);
                navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
              },
            },
          );
        },
      });
    }

    result.push(
      {
        id: 'action:dms',
        kind: 'action',
        label: t('nav.directMessages'),
        icon: Search,
        run: () => {
          setFriendsOpen(false);
          navigate(`/channels/${DM_ROUTE}`);
        },
      },
      {
        id: 'action:friends',
        kind: 'action',
        label: t('friends.title'),
        icon: Users,
        run: () => setFriendsOpen(true),
      },
      {
        id: 'action:create-server',
        kind: 'action',
        label: t('nav.addServer'),
        icon: Plus,
        run: () => setDialog('create-server'),
      },
      {
        id: 'action:join-server',
        kind: 'action',
        label: t('nav.joinServer'),
        icon: Compass,
        run: () => setDialog('join-server'),
      },
      {
        id: 'action:settings',
        kind: 'action',
        label: t('nav.userSettings'),
        icon: Settings,
        run: () => setDialog('user-settings'),
      },
    );

    return result;
  }, [
    client,
    conversations,
    createConversation,
    currentUserId,
    friends,
    navigate,
    open,
    servers,
    setFriendsOpen,
    t,
  ]);

  const dialogs = (
    <>
      <CreateServerDialog open={dialog === 'create-server'} onClose={() => setDialog(null)} />
      <JoinServerDialog open={dialog === 'join-server'} onClose={() => setDialog(null)} />
      <UserSettingsDialog open={dialog === 'user-settings'} onClose={() => setDialog(null)} />
    </>
  );

  const matches = useMemo(() => {
    const scored = items
      .map((item) => {
        // Matching the detail too lets "general design" find #general on the
        // Design server.
        const primary = fuzzyMatch(query, item.label);
        const secondary = item.detail ? fuzzyMatch(query, `${item.label} ${item.detail}`) : null;
        const best =
          primary && secondary ? (primary.score >= secondary.score ? primary : secondary) : primary ?? secondary;
        return best ? { item, score: best.score } : null;
      })
      .filter((entry): entry is { item: PaletteItem; score: number } => entry !== null);

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const kindDelta = SECTION_ORDER.indexOf(a.item.kind) - SECTION_ORDER.indexOf(b.item.kind);
      if (kindDelta !== 0) return kindDelta;
      return a.item.label.localeCompare(b.item.label);
    });

    return scored.slice(0, 40).map((entry) => entry.item);
  }, [items, query]);

  // Grouped for display, but the keyboard walks one flat list.
  const groups = useMemo(() => {
    const byKind = new Map<ItemKind, PaletteItem[]>();
    for (const item of matches) {
      const bucket = byKind.get(item.kind);
      if (bucket) bucket.push(item);
      else byKind.set(item.kind, [item]);
    }
    return SECTION_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
      kind,
      items: byKind.get(kind) ?? [],
    }));
  }, [matches]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const select = useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      close();
      item.run();
    },
    [close],
  );

  // A dialog opened from the palette outlives the palette itself.
  if (!open) return dialogs;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label={t('palette.open')}
    >
      <button
        type="button"
        aria-label={t('palette.hintClose')}
        className="absolute inset-0 cursor-default bg-surface-overlay"
        onClick={close}
      />

      <div
        className="relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-lg bg-surface-floating shadow-floating"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => (flat.length ? (current + 1) % flat.length : 0));
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => (flat.length ? (current - 1 + flat.length) % flat.length : 0));
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            select(flat[activeIndex]);
          }
        }}
      >
        <div className="flex items-center gap-2.5 px-3.5 shadow-hairline-b">
          <Search size={15} className="shrink-0 text-text-faint" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
          />
        </div>

        <div ref={listRef} className="scroller max-h-[52vh] py-1.5">
          {flat.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-sm text-text-muted">{t('palette.empty')}</p>
          ) : (
            groups.map((group) => (
              <section key={group.kind}>
                <h2 className="px-3.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.06em] text-text-faint">
                  {t(SECTION_LABEL[group.kind])}
                </h2>
                <ul>
                  {group.items.map((item) => {
                    const index = flat.indexOf(item);
                    const active = index === activeIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-active={active ? 'true' : undefined}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={() => select(item)}
                          className={cn(
                            'flex w-full items-center gap-2.5 px-3.5 py-1.5 text-left',
                            active ? 'bg-surface-selected text-text-heading' : 'text-text',
                          )}
                        >
                          <item.icon size={14} className="shrink-0 text-text-faint" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                          {item.detail ? (
                            <span className="shrink-0 truncate text-xs text-text-faint">
                              {item.detail}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer className="flex items-center gap-3 px-3.5 py-2 text-2xs text-text-faint shadow-hairline-t">
          <Hint keys="↑↓" label={t('palette.hintNavigate')} />
          <Hint keys="↵" label={t('palette.hintSelect')} />
          <Hint keys="esc" label={t('palette.hintClose')} />
        </footer>
      </div>

      {dialogs}
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded-sm bg-surface-accent px-1.5 py-0.5 font-sans text-2xs text-text-muted">
        {keys}
      </kbd>
      {label}
    </span>
  );
}
