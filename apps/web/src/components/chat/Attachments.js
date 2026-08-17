import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { isAudioMime, isImageMime, isVideoMime } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
const MAX_INLINE_WIDTH = 520;
const MAX_INLINE_HEIGHT = 350;
/** Scales an image down to the inline bounds while preserving aspect ratio. */
function inlineSize(attachment) {
    if (!attachment.width || !attachment.height)
        return null;
    const scale = Math.min(1, MAX_INLINE_WIDTH / attachment.width, MAX_INLINE_HEIGHT / attachment.height);
    return {
        width: Math.round(attachment.width * scale),
        height: Math.round(attachment.height * scale),
    };
}
export function Attachments({ attachments }) {
    const [lightbox, setLightbox] = useState(null);
    if (attachments.length === 0)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "mt-1 flex flex-col gap-2", children: attachments.map((attachment) => {
                    if (isImageMime(attachment.contentType)) {
                        const size = inlineSize(attachment);
                        return (_jsx("button", { type: "button", onClick: () => setLightbox(attachment), className: "block max-w-full overflow-hidden rounded-lg", style: size ? { width: size.width, maxWidth: '100%' } : undefined, children: _jsx("img", { src: attachment.url, alt: attachment.filename, width: size?.width, height: size?.height, loading: "lazy", decoding: "async", className: "h-auto w-full rounded-lg bg-base-tertiary object-cover" }) }, attachment.id));
                    }
                    if (isVideoMime(attachment.contentType)) {
                        return (_jsx("video", { src: attachment.url, controls: true, preload: "metadata", className: "max-w-full rounded-lg bg-black", style: { maxWidth: MAX_INLINE_WIDTH } }, attachment.id));
                    }
                    if (isAudioMime(attachment.contentType)) {
                        return (_jsx("audio", { src: attachment.url, controls: true, preload: "metadata", className: "w-full max-w-[420px]" }, attachment.id));
                    }
                    return _jsx(FileCard, { attachment: attachment }, attachment.id);
                }) }), lightbox ? (_jsxs("div", { role: "dialog", "aria-modal": "true", className: "fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(0,0,0,0.85)] p-4", onClick: () => setLightbox(null), children: [_jsx("img", { src: lightbox.url, alt: lightbox.filename, className: "max-h-full max-w-full rounded-lg object-contain" }), _jsx("button", { type: "button", "aria-label": "Close", onClick: () => setLightbox(null), className: "absolute right-4 top-[calc(env(safe-area-inset-top,0px)+16px)] flex h-touch w-touch items-center justify-center rounded-full bg-base-floating text-text-heading", children: _jsx(X, { size: 22, "aria-hidden": true }) })] })) : null] }));
}
function FileCard({ attachment }) {
    return (_jsxs("a", { href: attachment.url, target: "_blank", rel: "noopener noreferrer", download: true, className: cn('flex max-w-[420px] items-center gap-3 rounded-lg bg-base-secondary px-3 py-2.5', 'no-underline transition-colors hover:bg-surface-hover'), children: [_jsx(FileText, { size: 24, className: "shrink-0 text-brand", "aria-hidden": true }), _jsxs("span", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("span", { className: "truncate text-base text-text-link", children: attachment.filename }), _jsx("span", { className: "text-xs text-text-muted", children: formatBytes(attachment.size) })] }), _jsx(Download, { size: 18, className: "shrink-0 text-text-muted", "aria-hidden": true })] }));
}
export function LinkPreviews({ previews }) {
    if (previews.length === 0)
        return null;
    return (_jsx("div", { className: "mt-1 flex flex-col gap-2", children: previews.map((preview) => (_jsxs("a", { href: preview.url, target: "_blank", rel: "noopener noreferrer nofollow", className: cn('flex max-w-[440px] gap-3 rounded border-l-4 border-l-[#4f545c] bg-base-secondary p-3', 'no-underline transition-colors hover:bg-surface-hover'), children: [_jsxs("span", { className: "flex min-w-0 flex-1 flex-col gap-1", children: [preview.siteName ? (_jsx("span", { className: "text-xs text-text-muted", children: preview.siteName })) : null, preview.title ? (_jsx("span", { className: "truncate text-base font-semibold text-text-link", children: preview.title })) : null, preview.description ? (_jsx("span", { className: "line-clamp-3 text-sm text-text", children: preview.description })) : null] }), preview.imageUrl ? (_jsx("img", { src: preview.imageUrl, alt: "", loading: "lazy", decoding: "async", className: "h-20 w-20 shrink-0 rounded object-cover" })) : null] }, preview.url))) }));
}
export function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=Attachments.js.map