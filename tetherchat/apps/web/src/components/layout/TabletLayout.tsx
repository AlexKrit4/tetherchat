import { AnimatePresence, motion } from 'framer-motion';
import { ServerRail } from './ServerRail';
import { ChannelSidebar } from './ChannelSidebar';
import { MemberList } from './MemberList';
import { ChatArea } from '@/components/chat/ChatArea';
import { useUiStore } from '@/stores/uiStore';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useT } from '@/i18n/useT';

/**
 * 768–1023px: rail, channels and chat stay side by side, but there is no room
 * for a fourth column, so members slide over the chat instead.
 */
export function TabletLayout() {
  const t = useT();
  const membersOpen = useUiStore((state) => state.membersOverlayOpen);
  const setMembersOpen = useUiStore((state) => state.setMembersOverlayOpen);
  const { channelId } = useChatTarget();

  return (
    <div className="relative flex h-screen-dvh w-full overflow-hidden bg-surface-tertiary">
      <ServerRail />
      <ChannelSidebar />
      <ChatArea />

      <AnimatePresence>
        {membersOpen && channelId ? (
          <>
            <motion.button
              type="button"
              aria-label={t('common.closeMemberList')}
              className="absolute inset-0 z-20 bg-surface-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMembersOpen(false)}
            />
            <motion.div
              className="absolute right-0 top-0 z-30 h-full w-[260px] shadow-floating"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            >
              <MemberList className="h-full w-full" />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
