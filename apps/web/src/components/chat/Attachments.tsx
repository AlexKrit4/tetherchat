import { useState } from 'react';
import { Download, FileText, Captions } from 'lucide-react';
import { isAudioMime, isImageMime, isVideoMime } from '@tetherchat/shared';
import type { Attachment, LinkPreview } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { MediaLightbox } from './MediaLightbox';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePlusStore } from '@/stores/plusStore';
import { toast } from '@/stores/toastStore';

const MAX_INLINE_WIDTH = 520;
const MAX_INLINE_HEIGHT = 350;

/** Scales an image down to the inline bounds while preserving aspect ratio. */
function inlineSize(attachment: Attachment): { width: number; height: number } | null {
  if (!attachment.width || !attachment.height) return null;
  const scale = Math.min(
    1,
    MAX_INLINE_WIDTH / attachment.width,
    MAX_INLINE_HEIGHT / attachment.height,
  );
  return {
    width: Math.round(attachment.width * scale),
    height: Math.round(attachment.height * scale),
  };
}

export function Attachments({ attachments }: { attachments: Attachment[] }) {
  const t = useT();
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  if (attachments.length === 0) return null;
  const gallery = attachments.filter((item) => isImageMime(item.contentType) || isVideoMime(item.contentType));

  return (
    <>
      <div className="mt-1 flex flex-col gap-2">
        {attachments.map((attachment) => {
          if (isImageMime(attachment.contentType)) {
            const size = inlineSize(attachment);
            const spoiler = Boolean(attachment.spoiler) && !revealed.has(attachment.id);
            return (
              <button
                key={attachment.id}
                type="button"
                onClick={() => {
                  if (spoiler) {
                    setRevealed((current) => new Set(current).add(attachment.id));
                    return;
                  }
                  setLightbox(attachment);
                }}
                className="relative block max-w-full overflow-hidden rounded-lg"
                style={size ? { width: size.width, maxWidth: '100%' } : undefined}
              >
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  width={size?.width}
                  height={size?.height}
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    'h-auto w-full rounded-lg bg-surface-tertiary object-cover',
                    spoiler && 'blur-2xl brightness-50',
                  )}
                  style={
                    attachment.thumbnailData && !spoiler
                      ? { backgroundImage: `url(${attachment.thumbnailData})`, backgroundSize: 'cover' }
                      : undefined
                  }
                />
                {spoiler ? (
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
                    {t('chat.spoilerReveal')}
                  </span>
                ) : null}
              </button>
            );
          }

          if (isVideoMime(attachment.contentType)) {
            return (
              <video
                key={attachment.id}
                src={attachment.url}
                controls
                preload="metadata"
                className="max-w-full rounded-lg bg-black"
                style={{ maxWidth: MAX_INLINE_WIDTH }}
              />
            );
          }

          if (isAudioMime(attachment.contentType)) {
            return <VoiceBubble key={attachment.id} attachment={attachment} />;
          }

          return <FileCard key={attachment.id} attachment={attachment} />;
        })}
      </div>

      {lightbox ? (
        <MediaLightbox items={gallery} current={lightbox} onClose={() => setLightbox(null)} onChange={setLightbox} />
      ) : null}
    </>
  );
}

function VoiceBubble({ attachment }: { attachment: Attachment }) {
  const t = useT();
  const plus = useAuthStore((state) => state.user?.isPlus);
  const showPlus = usePlusStore((state) => state.show);
  const [transcript, setTranscript] = useState(attachment.transcript ?? '');
  const [busy, setBusy] = useState(false);
  const seconds = Math.max(1, Math.round((attachment.durationMs ?? 0) / 1000));

  const transcribe = async () => {
    if (!plus) {
      showPlus('transcript');
      return;
    }
    if (transcript) return;
    setBusy(true);
    try {
      const result = await api.post<{ transcript: string }>(`/api/attachments/${attachment.id}/transcribe`);
      setTranscript(result.transcript);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-[420px] flex-col gap-2 rounded-2xl bg-surface-secondary px-3 py-2.5">
      <div className="flex items-center gap-3">
        <audio src={attachment.url} controls preload="metadata" className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => void transcribe()}
          disabled={busy}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium',
            plus ? 'bg-brand text-white hover:bg-brand-hover' : 'bg-surface-tertiary text-text-muted',
          )}
          title={t('plus.transcribe')}
        >
          <Captions size={16} aria-hidden />
          {busy ? t('plus.transcribing') : t('plus.transcribe')}
        </button>
      </div>
      <p className="text-xs text-text-muted">{seconds}с</p>
      {transcript ? <p className="whitespace-pre-wrap text-sm text-text">{transcript}</p> : null}
    </div>
  );
}

function FileCard({ attachment }: { attachment: Attachment }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download
      className={cn(
        'flex max-w-[420px] items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2.5',
        'no-underline transition-colors hover:bg-surface-hover',
      )}
    >
      <FileText size={24} className="shrink-0 text-brand" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base text-text-link">{attachment.filename}</span>
        <span className="text-xs text-text-muted">{formatBytes(attachment.size)}</span>
      </span>
      <Download size={18} className="shrink-0 text-text-muted" aria-hidden />
    </a>
  );
}

export function LinkPreviews({ previews }: { previews: LinkPreview[] }) {
  if (previews.length === 0) return null;

  return (
    <div className="mt-1 flex flex-col gap-2">
      {previews.map((preview) => (
        <a
          key={preview.url}
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={cn(
            'flex max-w-[440px] gap-3 rounded border-l-4 border-l-[#4f545c] bg-surface-secondary p-3',
            'no-underline transition-colors hover:bg-surface-hover',
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {preview.siteName ? (
              <span className="text-xs text-text-muted">{preview.siteName}</span>
            ) : null}
            {preview.title ? (
              <span className="truncate text-base font-semibold text-text-link">{preview.title}</span>
            ) : null}
            {preview.description ? (
              <span className="line-clamp-3 text-sm text-text">{preview.description}</span>
            ) : null}
          </span>
          {preview.imageUrl ? (
            <img
              src={preview.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-20 w-20 shrink-0 rounded object-cover"
            />
          ) : null}
        </a>
      ))}
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
