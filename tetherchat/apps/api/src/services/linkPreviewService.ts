import { getConfig } from '../config.js';
import { prisma } from '../db.js';
import { toMessage, messageInclude } from '../lib/serialize.js';
import { emitToChannel, emitToConversation } from '../ws/realtime.js';
import type { LinkPreview } from '@tetherchat/shared';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 512 * 1024;

const META_TAG = /<meta\s+[^>]*>/gi;
const TITLE_TAG = /<title[^>]*>([\s\S]*?)<\/title>/i;

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  if (!match) return null;
  return match[2] ?? match[3] ?? null;
}

/** Minimal Open Graph scraper: reads meta tags without pulling in a DOM parser. */
export function parseOpenGraph(html: string, url: string): LinkPreview {
  const meta = new Map<string, string>();

  for (const tag of html.match(META_TAG) ?? []) {
    const key = attribute(tag, 'property') ?? attribute(tag, 'name');
    const content = attribute(tag, 'content');
    if (key && content) meta.set(key.toLowerCase(), decodeEntities(content));
  }

  const titleTag = TITLE_TAG.exec(html);

  return {
    url,
    title: meta.get('og:title') ?? meta.get('twitter:title') ?? (titleTag ? decodeEntities(titleTag[1]) : null),
    description: meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description') ?? null,
    imageUrl: meta.get('og:image') ?? meta.get('twitter:image') ?? null,
    siteName: meta.get('og:site_name') ?? new URL(url).hostname,
  };
}

function isPublicUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  // Block obvious SSRF targets; a full IP-range check happens at the egress proxy.
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === '[::1]' || host === '::1') return false;
  return true;
}

export async function fetchPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isPublicUrl(url)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'TetherChatBot/1.0 (+https://tetherchat.ru)', accept: 'text/html' },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    const buffer = await response.arrayBuffer();
    const html = Buffer.from(buffer.slice(0, MAX_HTML_BYTES)).toString('utf8');
    return parseOpenGraph(html, url.toString());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves previews for a message and re-broadcasts it once they land. */
export async function attachPreviews(messageId: string, urls: string[]): Promise<void> {
  if (!getConfig().ENABLE_LINK_PREVIEWS || urls.length === 0) return;

  const previews = (await Promise.all(urls.map(fetchPreview))).filter(
    (preview): preview is LinkPreview => Boolean(preview?.title || preview?.imageUrl),
  );
  if (previews.length === 0) return;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) return;

  await prisma.linkPreview.createMany({
    data: previews.map((preview) => ({
      messageId,
      url: preview.url,
      title: preview.title,
      description: preview.description,
      imageUrl: preview.imageUrl,
      siteName: preview.siteName,
    })),
    skipDuplicates: true,
  });

  const updated = await prisma.message.findUnique({
    where: { id: messageId },
    include: messageInclude,
  });
  if (!updated) return;

  const payload = toMessage(updated, null);
  if (updated.channelId) emitToChannel(updated.channelId, 'message:updated', payload);
  else if (updated.conversationId) {
    emitToConversation(updated.conversationId, 'message:updated', payload);
  }
}
