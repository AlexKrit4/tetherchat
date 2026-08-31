/**
 * Subsequence matching for the command palette.
 *
 * A query matches when its characters appear in order anywhere in the target,
 * so "gnr" finds "general-random". Scoring favours matches that start at a word
 * boundary and whose characters sit close together, which is what makes a short
 * query land on the channel the reader meant rather than the first one that
 * happens to contain those letters.
 */
export interface FuzzyMatch {
  score: number;
  /** Indices in the target that the query matched, for highlighting. */
  positions: number[];
}

const WORD_BOUNDARY = /[\s\-_/.:#@]/;

/** Scores one alignment, scanning greedily from a fixed starting index. */
function scoreFrom(needle: string, haystack: string, start: number): FuzzyMatch | null {
  const positions: number[] = [];
  let score = 0;
  let cursor = start;
  let previousIndex = -2;

  for (const char of needle) {
    const index = haystack.indexOf(char, cursor);
    if (index === -1) return null;

    // Adjacent characters mean the query is spelling the target out.
    if (index === previousIndex + 1) score += 8;

    if (index === 0) score += 12;
    else if (WORD_BOUNDARY.test(haystack[index - 1])) score += 9;

    // Skipping characters to reach this one weakens the match.
    score -= Math.min(index - cursor, 8);

    positions.push(index);
    previousIndex = index;
    cursor = index + 1;
  }

  // A short target that used most of its characters is a better hit than a long
  // one that happened to contain the same letters.
  score += Math.round((needle.length / haystack.length) * 14);

  return { score, positions };
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  if (!query) return { score: 0, positions: [] };

  const needle = query.toLowerCase();
  const haystack = target.toLowerCase();

  /**
   * Scanning greedily from the left takes the first occurrence of each
   * character, which can step over a far better alignment: in "general-random"
   * a query of "rand" would latch onto the r of "general" and then straggle
   * across the word, scoring worse than the same query against "brandenburg"
   * even though "general-random" contains it whole at a word boundary.
   *
   * Restarting the scan at every occurrence of the first character and keeping
   * the best result fixes that. Palette entries are channel and person names,
   * so the extra passes are over a handful of characters.
   */
  let best: FuzzyMatch | null = null;
  const first = needle[0];

  for (let start = 0; start < haystack.length; start += 1) {
    if (haystack[start] !== first) continue;
    const candidate = scoreFrom(needle, haystack, start);
    if (candidate && (!best || candidate.score > best.score)) best = candidate;
  }

  return best;
}
