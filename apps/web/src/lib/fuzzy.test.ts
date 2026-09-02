import { describe, expect, it } from 'vitest';
import { fuzzyMatch } from './fuzzy';

function rank(query: string, targets: string[]): string[] {
  return targets
    .map((target) => ({ target, match: fuzzyMatch(query, target) }))
    .filter((entry): entry is { target: string; match: { score: number; positions: number[] } } =>
      entry.match !== null,
    )
    .sort((a, b) => b.match.score - a.match.score)
    .map((entry) => entry.target);
}

describe('fuzzyMatch', () => {
  it('matches characters in order but not necessarily adjacent', () => {
    expect(fuzzyMatch('gnr', 'general-random')).not.toBeNull();
    expect(fuzzyMatch('gnr', 'random-general')).not.toBeNull();
  });

  it('rejects a query whose characters are out of order', () => {
    expect(fuzzyMatch('rg', 'general')).toBeNull();
  });

  it('rejects a query with characters the target does not have', () => {
    expect(fuzzyMatch('genz', 'general')).toBeNull();
  });

  it('treats an empty query as matching everything', () => {
    expect(fuzzyMatch('', 'general')).toEqual({ score: 0, positions: [] });
  });

  it('is case insensitive', () => {
    expect(fuzzyMatch('GEN', 'general')).not.toBeNull();
    expect(fuzzyMatch('gen', 'GENERAL')).not.toBeNull();
  });

  it('reports where it matched so the caller can highlight', () => {
    expect(fuzzyMatch('gen', 'general')?.positions).toEqual([0, 1, 2]);
  });

  it('picks the best alignment rather than the leftmost one', () => {
    // The r of "general" comes first, but the contiguous run in "random" is the
    // match a reader typing "rand" means.
    expect(fuzzyMatch('rand', 'general-random')?.positions).toEqual([8, 9, 10, 11]);
  });

  it('prefers a prefix over a match buried in the middle', () => {
    expect(rank('gen', ['ungenerous', 'general'])[0]).toBe('general');
  });

  it('prefers a word boundary over a match inside a word', () => {
    expect(rank('rand', ['brandenburg', 'general-random'])[0]).toBe('general-random');
  });

  it('prefers the shorter of two targets that both match', () => {
    expect(rank('dev', ['dev', 'development-notes-archive'])[0]).toBe('dev');
  });

  it('prefers contiguous letters over letters scattered across the target', () => {
    expect(rank('des', ['design', 'do-everything-slowly'])[0]).toBe('design');
  });

  it('matches across a word boundary, so a two-word query finds one channel', () => {
    expect(fuzzyMatch('gen des', 'general design')).not.toBeNull();
  });
});
