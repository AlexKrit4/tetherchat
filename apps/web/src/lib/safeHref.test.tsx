import { render } from '@testing-library/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';
import { safeHref, safeHttpUrl } from './safeHref';

describe('safeHref', () => {
  it('keeps http(s), mailto, in-app paths and fragments', () => {
    expect(safeHref('https://tetherchat.ru/help')).toBe('https://tetherchat.ru/help');
    expect(safeHref('http://example.test/a')).toBe('http://example.test/a');
    expect(safeHref('mailto:ops@tetherchat.ru')).toBe('mailto:ops@tetherchat.ru');
    expect(safeHref('/channels/@me')).toBe('/channels/@me');
    expect(safeHref('#section')).toBe('#section');
  });

  it('drops javascript, data and other scriptable schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('JAVASCRIPT:alert(1)')).toBeUndefined();
    expect(safeHref('  javascript:fetch("/api/auth/refresh")  ')).toBeUndefined();
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeHref('vbscript:msgbox(1)')).toBeUndefined();
  });
});

describe('safeHttpUrl', () => {
  it('keeps http(s) and rejects everything else', () => {
    expect(safeHttpUrl('https://cdn.example/og.png')).toBe('https://cdn.example/og.png');
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('data:image/svg+xml,<svg></svg>')).toBeUndefined();
    expect(safeHttpUrl('mailto:ops@tetherchat.ru')).toBeUndefined();
  });
});

describe('markdown links', () => {
  it('does not leave a javascript: href in the DOM after sanitizing', () => {
    const { container } = render(
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={safeHref(href)} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {'[click](javascript:alert(document.cookie))'}
      </Markdown>,
    );
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBeNull();
  });
});
