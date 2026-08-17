import { useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { isAudioMime, isImageMime, isVideoMime } from '@tetherchat/shared';
import type { Attachment, LinkPreview } from '@tetherchat/shared';
import { cn } from '@/lib/cn';

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
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mt-1 flex flex-col gap-2">
        {attachments.map((attachment) => {
          if (isImageMime(attachment.contentType)) {
            const size = inlineSize(attachment);
            return (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setLightbox(attachment)}
                className="block max-w-full overflow-hidden rounded-lg"
                style={size ? { width: size.width, maxWidth: '100%' } : undefined}
              >
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  width={size?.width}
                  height={size?.height}
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-full rounded-lg bg-base-tertiary object-cover"
                />
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
            return (
              <audio
                key={attachment.id}
                src={attachment.url}
                controls
                preload="metadata"
                className="w-full max-w-[420px]"
              />
            );
          }

          return <FileCard key={attachment.id} attachment={attachment} />;
        })}
      </div>

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(0,0,0,0.85)] p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.url}
            alt={lightbox.filename}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+16px)] flex h-touch w-touch items-center justify-center rounded-full bg-base-floating text-text-heading"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
      ) : null}
    </>
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
        'flex max-w-[420px] items-center gap-3 rounded-lg bg-base-secondary px-3 py-2.5',
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
            'flex max-w-[440px] gap-3 rounded border-l-4 border-l-[#4f545c] bg-base-secondary p-3',
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
