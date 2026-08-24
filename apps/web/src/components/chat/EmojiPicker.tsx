import { lazy, Suspense, useEffect } from 'react';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Spinner } from '@/components/ui/Spinner';

// emoji-mart's dataset is large; keep it out of the initial bundle.
const Picker = lazy(async () => {
  const [{ default: Component }, { default: data }] = await Promise.all([
    import('@emoji-mart/react'),
    import('@emoji-mart/data'),
  ]);
  return {
    default: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
      <Component
        data={data}
        theme="dark"
        previewPosition="none"
        skinTonePosition="search"
        onEmojiSelect={(emoji: { native?: string; shortcodes?: string }) => {
          if (emoji.native) onSelect(emoji.native);
        }}
      />
    ),
  };
});

export interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

/**
 * A bottom sheet on touch and a floating panel on desktop — the same picker in
 * both cases, only the container changes.
 */
export function EmojiPicker({ open, onClose, onSelect }: EmojiPickerProps) {
  const t = useT();
  const isMobile = useIsMobile();

  // The sheet handles Escape itself; the floating desktop panel needs its own.
  useEffect(() => {
    if (!open || isMobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, onClose, open]);

  const picker = (
    <Suspense
      fallback={
        <div className="flex h-[320px] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Picker
        onSelect={(emoji) => {
          onSelect(emoji);
          onClose();
        }}
      />
    </Suspense>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title={t('chat.reactions')}>
        <div className="flex justify-center px-2 pb-2">{picker}</div>
      </BottomSheet>
    );
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label={t('chat.closePicker')}
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div className="absolute bottom-full right-0 z-50 mb-2 overflow-hidden rounded-lg shadow-floating">
        {picker}
      </div>
    </>
  );
}
