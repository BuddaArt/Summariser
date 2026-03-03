/* <summariser>ExtractedSymbols from source code with regex-based pattern matching and member extraction capabilities.</summariser> */
// ─── Universal Pattern System Types ──────────────────────────────────────────

/**
 * A single extracted symbol from source code.
 */
export interface ExtractedSymbol {
  kind: 'class' | 'interface' | 'function' | 'constant' | 'enum' | 'type';
  name: string;
  /** For classes/interfaces: their methods/properties */
  members?: string[];
}

/**
 * A pattern rule defines how to extract one kind of symbol from source text.
 *
 * priority: lower number = more important (shown first / drives the summary format)
 * maxInlinedItems: when summarising a single dominant symbol, show this many
 *   members inline; the rest are collapsed to "+N more"
 * maxTopLevel: how many top-level symbols of this kind to show before collapsing
 */
export interface PatternRule {
  kind: ExtractedSymbol['kind'];
  priority: number;
  /** Regex to find symbol names.  Must have a named capture (?<name>…) */
  regex: RegExp;
  /**
   * Optional regex to find members *inside* a symbol block.
   * Only used for classes/interfaces.  Must have (?<name>…).
   */
  memberRegex?: RegExp;
  /** Max members to show inline when there is exactly one parent symbol */
  maxInlinedMembers: number;
  /** Max top-level symbols to show before collapsing */
  maxTopLevel: number;
}

/**
 * Language-specific pattern set.
 * fileExtensions: list of extensions this set applies to (without leading dot).
 * rules: ordered list of pattern rules.
 */
export interface PatternSet {
  language: string;
  fileExtensions: string[];
  rules: PatternRule[];
}

/**
 * The result of running patterns against one file.
 */
export interface PatternResult {
  symbols: ExtractedSymbol[];
}
