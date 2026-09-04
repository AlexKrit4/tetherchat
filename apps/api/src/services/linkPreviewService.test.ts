import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPreview,
  isAllowedPreviewTarget,
  isBlockedPreviewHost,
  isPrivateIp,
  isPublicPreviewUrl,
  parseOpenGraph,
} from './linkPreviewService.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseOpenGraph', () => {
  it('reads Open Graph tags', () => {
    const preview = parseOpenGraph(
      '<html><head><meta property="og:title" content="Hello &amp; Co"><title>Fallback</title></head></html>',
      'https://example.com/post',
    );
    expect(preview.title).toBe('Hello & Co');
    expect(preview.siteName).toBe('example.com');
  });
});

describe('preview URL allowlist', () => {
  it('rejects loopback, RFC1918, link-local, and docker hostnames before fetch', () => {
    expect(isBlockedPreviewHost('127.0.0.1')).toBe(true);
    expect(isBlockedPreviewHost('10.0.0.8')).toBe(true);
    expect(isBlockedPreviewHost('192.168.1.1')).toBe(true);
    expect(isBlockedPreviewHost('169.254.169.254')).toBe(true);
    expect(isBlockedPreviewHost('172.16.0.2')).toBe(true);
    expect(isBlockedPreviewHost('localhost')).toBe(true);
    expect(isBlockedPreviewHost('host.docker.internal')).toBe(true);
    expect(isBlockedPreviewHost('metadata.google.internal')).toBe(true);
    expect(isBlockedPreviewHost('[::1]')).toBe(true);
    expect(isPrivateIp('::ffff:7f00:1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('rejects non-http schemes and URLs with userinfo', () => {
    expect(isPublicPreviewUrl(new URL('file:///etc/passwd'))).toBe(false);
    expect(isPublicPreviewUrl(new URL('http://user:pass@example.com/'))).toBe(false);
    expect(isPublicPreviewUrl(new URL('https://example.com/a'))).toBe(true);
  });

  it('does not fetch loopback or docker-internal URLs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchPreview('http://127.0.0.1/admin')).toBeNull();
    expect(await fetchPreview('http://localhost:4000/api/health')).toBeNull();
    expect(await fetchPreview('http://host.docker.internal:8000/')).toBeNull();
    expect(await fetchPreview('http://169.254.169.254/latest/meta-data/')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not follow a public URL that redirects onto a private host', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith('https://203.0.113.10/')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1:8000/dashboard' },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchPreview('https://203.0.113.10/open')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('203.0.113.10');
  });

  it('does not follow a relative-looking redirect that targets loopback', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 301,
        headers: { location: 'http://[::1]/' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchPreview('https://203.0.113.10/jump')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses HTML from an allowed public hop', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('<html><head><meta property="og:title" content="Safe"></head></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const preview = await fetchPreview('https://203.0.113.10/ok');
    expect(preview?.title).toBe('Safe');
  });
});

describe('isAllowedPreviewTarget', () => {
  it('rejects IPv4-mapped loopback even when the hostname looks v6', async () => {
    expect(await isAllowedPreviewTarget(new URL('http://[::ffff:127.0.0.1]/'))).toBe(false);
  });
});
