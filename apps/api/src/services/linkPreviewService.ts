import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { getConfig } from '../config.js';
import { prisma } from '../db.js';
import { toMessage, messageInclude } from '../lib/serialize.js';
import { emitToChannel, emitToConversation } from '../ws/realtime.js';
import type { LinkPreview } from '@tetherchat/shared';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

const META_TAG = /<meta\s+[^>]*>/gi;
const TITLE_TAG = /<title[^>]*>([\s\S]*?)<\/title>/i;

const PRIVATE_V4 = new BlockList();
PRIVATE_V4.addSubnet('0.0.0.0', 8, 'ipv4');
PRIVATE_V4.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE_V4.addSubnet('127.0.0.0', 8, 'ipv4');
PRIVATE_V4.addSubnet('169.254.0.0', 16, 'ipv4');
PRIVATE_V4.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE_V4.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE_V4.addSubnet('224.0.0.0', 4, 'ipv4');
PRIVATE_V4.addSubnet('240.0.0.0', 4, 'ipv4');

const PRIVATE_V6 = new BlockList();
PRIVATE_V6.addAddress('::', 'ipv6');
PRIVATE_V6.addAddress('::1', 'ipv6');
PRIVATE_V6.addSubnet('fc00::', 7, 'ipv6');
PRIVATE_V6.addSubnet('fe80::', 10, 'ipv6');
PRIVATE_V6.addSubnet('ff00::', 8, 'ipv6');

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

function stripBrackets(host: string): string {
  return host.replace(/^\[|\]$/g, '');
}

function embeddedIpv4(ip: string): string | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (dotted) return dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (!hex) return null;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

export function isPrivateIp(ip: string): boolean {
  const mapped = embeddedIpv4(ip);
  if (mapped) return isPrivateIp(mapped);
  const version = isIP(ip);
  if (version === 4) return PRIVATE_V4.check(ip, 'ipv4');
  if (version === 6) return PRIVATE_V6.check(ip, 'ipv6');
  return true;
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'host.docker.internal',
  'metadata.google.internal',
  'metadata.google.com',
]);

export function isBlockedPreviewHost(hostname: string): boolean {
  const host = stripBrackets(hostname.toLowerCase());
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (isIP(host) && isPrivateIp(host)) return true;
  return false;
}

/** True when the URL may be fetched for a link preview (scheme + host, no DNS). */
export function isPublicPreviewUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  return !isBlockedPreviewHost(url.hostname);
}

async function resolvedAddresses(hostname: string): Promise<string[]> {
  const host = stripBrackets(hostname);
  if (isIP(host)) return [host];
  const records = await lookup(host, { all: true });
  return records.map((record) => record.address);
}

export async function isAllowedPreviewTarget(url: URL): Promise<boolean> {
  if (!isPublicPreviewUrl(url)) return false;
  try {
    const addresses = await resolvedAddresses(url.hostname);
    if (addresses.length === 0) return false;
    return addresses.every((address) => !isPrivateIp(address));
  } catch {
    return false;
  }
}

const PREVIEW_HEADERS = {
  'user-agent': 'TetherChatBot/1.0 (+https://tetherchat.ru)',
  accept: 'text/html',
};

async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

async function fetchPublicHtml(start: URL, signal: AbortSignal): Promise<Response | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!(await isAllowedPreviewTarget(current))) return null;

    const response = await fetch(current, {
      signal,
      redirect: 'manual',
      headers: PREVIEW_HEADERS,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await discardBody(response);
      if (!location || hop === MAX_REDIRECTS) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }

    return response;
  }
  return null;
}

export async function fetchPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchPublicHtml(url, controller.signal);
    if (!response) return null;
    if (!response.ok) {
      await discardBody(response);
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      await discardBody(response);
      return null;
    }

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
