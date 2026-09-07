import { LIMITS } from '@tetherchat/shared';
import type { ComposerDraft } from '@tetherchat/shared';

const MAX_DRAFTS = 200;

export type DraftMap = Record<string, ComposerDraft>;

export function parseDrafts(raw: unknown): DraftMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: DraftMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || key.length > 64) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = value as { text?: unknown; updatedAt?: unknown };
    if (typeof entry.text !== 'string') continue;
    const updatedAt = typeof entry.updatedAt === 'number' ? entry.updatedAt : 0;
    out[key] = {
      text: entry.text.slice(0, LIMITS.messageContent.max),
      updatedAt,
    };
  }
  return out;
}

export function mergeDrafts(current: DraftMap, incoming: DraftMap): DraftMap {
  const next = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = next[key];
    if (!existing || value.updatedAt >= existing.updatedAt) {
      if (value.text.trim().length === 0) delete next[key];
      else next[key] = value;
    }
  }
  const keys = Object.keys(next);
  if (keys.length <= MAX_DRAFTS) return next;
  const keep = keys
    .sort((a, b) => next[b].updatedAt - next[a].updatedAt)
    .slice(0, MAX_DRAFTS);
  return Object.fromEntries(keep.map((key) => [key, next[key]]));
}
