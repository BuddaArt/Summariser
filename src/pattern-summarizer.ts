import * as fs from 'fs';
import * as path from 'path';
import { ExtractedSymbol, PatternRule, PatternSet } from './patterns/types';
import { getPatternSetForFile } from './patterns';
import { FileEntry } from './scanner';
import { FileSummary } from './summarizer';

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Extract all symbols of one rule from file content.
 * Resets lastIndex before each run to avoid stateful regex bugs.
 */
function extractSymbols(content: string, rule: PatternRule): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  rule.regex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = rule.regex.exec(content)) !== null) {
    const name = match.groups?.['name'];
    if (!name) continue;

    const symbol: ExtractedSymbol = { kind: rule.kind, name };

    if (rule.memberRegex && (rule.kind === 'class' || rule.kind === 'interface')) {
      symbol.members = extractMembers(content, match.index, rule.memberRegex);
    }

    symbols.push(symbol);
  }

  return symbols;
}

/**
 * Extract members (methods/properties) starting at `startIndex`.
 * Scans forward until the next top-level symbol starts (heuristic: a line
 * with the same or lower indentation that looks like a new declaration).
 * We extract from the entire content but only keep names that appear
 * between `startIndex` and the next class/member block boundary.
 *
 * Simple approach: extract all memberRegex matches from the block of text
 * that follows the class declaration — we grab the next 4000 chars max.
 */
function extractMembers(content: string, classStartIndex: number, memberRegex: RegExp): string[] {
  // Grab text after the class declaration line
  const block = content.slice(classStartIndex, classStartIndex + 4000);

  const names: string[] = [];
  const seen = new Set<string>();
  const rx = new RegExp(memberRegex.source, memberRegex.flags);
  rx.lastIndex = 0;

  let m: RegExpExecArray | null;
  // Skip the very first match (that's the class name itself captured by memberRegex
  // if the patterns overlap) — start from after the first newline
  const firstNewline = block.indexOf('\n');
  if (firstNewline === -1) return names;

  rx.lastIndex = firstNewline;
  while ((m = rx.exec(block)) !== null) {
    const name = m.groups?.['name'];
    if (!name || seen.has(name)) continue;
    // Skip common noise: constructor, super, common keywords captured accidentally
    if (/^(constructor|super|if|for|while|return|new|this|base|void|bool|string|int|var|let|const|async|await)$/.test(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= 20) break; // hard cap to avoid runaway extraction
  }

  return names;
}

// ─── Summary Formatting ───────────────────────────────────────────────────────

/**
 * Format extracted symbols into a compact one-line summary string.
 *
 * Priority rules:
 * 1. If there is exactly one class/interface → show its name + methods
 *    e.g.  UserService (Create, Delete, GetById… +3 more)
 * 2. If there are 2-4 classes → show their names
 *    e.g.  classes: OrderController, OrderDto, OrderValidator
 * 3. Otherwise fall through to functions, constants, etc.
 */
function formatSummary(symbols: ExtractedSymbol[], patternSet: PatternSet): string {
  if (symbols.length === 0) return '(no recognizable symbols)';

  // Group by kind
  const byKind = new Map<ExtractedSymbol['kind'], ExtractedSymbol[]>();
  for (const s of symbols) {
    if (!byKind.has(s.kind)) byKind.set(s.kind, []);
    byKind.get(s.kind)!.push(s);
  }

  // Sort rules by priority for rendering order
  const sortedRules = [...patternSet.rules].sort((a, b) => a.priority - b.priority);
  const parts: string[] = [];

  for (const rule of sortedRules) {
    const items = byKind.get(rule.kind);
    if (!items || items.length === 0) continue;

    if (rule.kind === 'class' || rule.kind === 'interface') {
      if (items.length === 1) {
        // Single dominant symbol → expand members
        const sym = items[0];
        const members = sym.members ?? [];
        if (members.length === 0) {
          parts.push(sym.name);
        } else {
          const shown = members.slice(0, rule.maxInlinedMembers);
          const extra = members.length - shown.length;
          const memberStr = extra > 0
            ? shown.join(', ') + `… +${extra} more`
            : shown.join(', ');
          parts.push(`${sym.name} (${memberStr})`);
        }
      } else {
        // Multiple → list names, collapse if too many
        const shown = items.slice(0, rule.maxTopLevel).map((s) => s.name);
        const extra = items.length - shown.length;
        const label = rule.kind === 'class' ? 'classes' : 'interfaces';
        if (extra > 0) {
          parts.push(`${label}: ${shown.join(', ')} +${extra} more`);
        } else {
          parts.push(`${label}: ${shown.join(', ')}`);
        }
      }
    } else {
      // functions, constants, enums, types
      const shown = items.slice(0, rule.maxTopLevel).map((s) => s.name);
      const extra = items.length - shown.length;
      const label = rule.kind;
      if (shown.length > 0) {
        if (extra > 0) {
          parts.push(`${label}: ${shown.join(', ')} +${extra} more`);
        } else {
          parts.push(`${label}: ${shown.join(', ')}`);
        }
      }
    }

    // Stop after the first non-empty dominant group (class/interface).
    // For lower-priority kinds continue building parts to fill gaps.
    if (parts.length > 0 && (rule.kind === 'class' || rule.kind === 'interface')) break;
  }

  return parts.join(' | ') || '(no recognizable symbols)';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function summarizeFileByPattern(file: FileEntry): FileSummary {
  const patternSet = getPatternSetForFile(path.basename(file.absolutePath));
  if (!patternSet) {
    return {
      file,
      summary: '(no pattern for this file type)',
    };
  }

  let content: string;
  try {
    content = fs.readFileSync(file.absolutePath, 'utf-8');
  } catch {
    return { file, summary: '[Could not read file]', error: 'unreadable' };
  }

  // Sort rules by priority, extract all symbols
  const sortedRules = [...patternSet.rules].sort((a, b) => a.priority - b.priority);
  const allSymbols: ExtractedSymbol[] = [];
  for (const rule of sortedRules) {
    allSymbols.push(...extractSymbols(content, rule));
  }

  const summary = formatSummary(allSymbols, patternSet);
  return { file, summary };
}

export function summarizeFilesByPattern(
  files: FileEntry[],
  onProgress?: (completed: number, total: number, result: FileSummary) => void
): FileSummary[] {
  const results: FileSummary[] = [];
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const result = summarizeFileByPattern(files[i]);
    results.push(result);
    onProgress?.(i + 1, total, result);
  }

  return results;
}
