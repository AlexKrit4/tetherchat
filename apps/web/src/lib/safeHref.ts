/**
 * href values that chat markdown, bios and OG previews may put on an <a> or
 * <img>. react-markdown leaves javascript:/data: URLs intact, and a click
 * would run attacker script as the signed-in user (refresh cookie + E2EE keys).
 */
const ALLOWED_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const ALLOWED_RESOURCE_PROTOCOLS = new Set(['http:', 'https:']);

function parseAbsolute(raw: string): URL | null {
  try {
    return raw.startsWith('//') ? new URL(`https:${raw}`) : new URL(raw);
  } catch {
    return null;
  }
}

/** Safe value for <a href>. Relative paths and fragments stay; dangerous schemes are dropped. */
export function safeHref(href: string | undefined | null): string | undefined {
  if (href == null) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('#') && !trimmed.includes(':')) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  const parsed = parseAbsolute(trimmed);
  if (!parsed) return undefined;
  return ALLOWED_HREF_PROTOCOLS.has(parsed.protocol.toLowerCase()) ? trimmed : undefined;
}

/** Safe value for <img src> / preview artwork — http(s) only. */
export function safeHttpUrl(url: string | undefined | null): string | undefined {
  if (url == null) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const parsed = parseAbsolute(trimmed);
  if (!parsed) return undefined;
  return ALLOWED_RESOURCE_PROTOCOLS.has(parsed.protocol.toLowerCase()) ? trimmed : undefined;
}
