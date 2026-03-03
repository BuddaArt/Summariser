import { PatternSet } from './types';
import { dotnetPatterns } from './dotnet';
import { nodejsPatterns } from './nodejs';

// ─── Pattern Registry ─────────────────────────────────────────────────────────

const ALL_PATTERNS: PatternSet[] = [dotnetPatterns, nodejsPatterns];

/** Returns the first matching PatternSet for a given file extension, or null. */
export function getPatternSetForFile(filename: string): PatternSet | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ALL_PATTERNS.find((ps) => ps.fileExtensions.includes(ext)) ?? null;
}

export { dotnetPatterns, nodejsPatterns };
export type { PatternSet };
