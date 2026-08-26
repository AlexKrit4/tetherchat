import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { isImageMime, isVideoMime } from '@tetherchat/shared';
import type { ChatMediaItem, Paginated } from '@tetherchat/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useT } from '@/i18n/useT';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useChatTarget } from '@/hooks/useChatTarget';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Spinner } from '@/components/ui/Spinner';
import { useUiStore } from '@/stores/uiStore';
import { MediaLightbox } from './MediaLightbox';

export function MediaPanel() {
  const t = useT();
  const open = useUiStore((state) => state.mediaOpen);
  const setOpen = useUiStore((state) => state.setMediaOpen);
  const { channelId, isDm } = useChatTarget();
  const [preview, setPreview] = useState<ChatMediaItem | null>(null);

  const query = useInfiniteQuery({
    queryKey: queryKeys.media(channelId ?? 'none'),
    enabled: open && Boolean(channelId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<ChatMediaItem>>(
        isDm ? `/api/dms/${channelId}/media` : `/api/channels/${channelId}/media`,
        { query: { before: pageParam, limit: 40 } },
      ),
    getNextPageParam: (last) =>
      last.hasMore && last.items.length > 0 ? last.items[last.items.length - 1].createdAt : undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <AdaptiveDialog open={open} onClose={() => setOpen(false)} title={t('chat.mediaTitle')} width="lg">
        {query.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ImageIcon size={32} className="text-text-faint" aria-hidden />
            <p className="text-base text-text-muted">{t('chat.mediaEmpty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreview(item)}
                className="relative aspect-square overflow-hidden rounded bg-surface-tertiary"
              >
                {isImageMime(item.contentType) ? (
                  <img
                    src={item.url}
                    alt=""
                    className={item.spoiler ? 'h-full w-full object-cover blur-xl brightness-50' : 'h-full w-full object-cover'}
                  />
                ) : isVideoMime(item.contentType) ? (
                  <video src={item.url} className="h-full w-full object-cover" muted />
                ) : null}
              </button>
            ))}
          </div>
        )}
      </AdaptiveDialog>
      <MediaLightbox
        items={items.filter((item) => isImageMime(item.contentType) || isVideoMime(item.contentType))}
        current={preview}
        onClose={() => setPreview(null)}
        onChange={setPreview}
      />
    </>
  );
}
