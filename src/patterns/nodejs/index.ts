/* <summariser>Pattern Set for Node.js/TypeScript with regex-based classification and member limits.</summariser> */
import { PatternSet } from '../types';

// ─── Node.js / TypeScript / JavaScript Pattern Set ───────────────────────────

export const nodejsPatterns: PatternSet = {
  language: 'nodejs',
  fileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
  rules: [
    {
      // Classes — highest priority
      kind: 'class',
      priority: 1,
      // export (default)? (abstract)? class Name
      regex: /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(?<name>\w+)/gm,
      // Methods: (public|private|protected|static|async|override|get|set)* name(
      memberRegex: /^\s*(?:(?:public|private|protected|static|async|override|abstract|readonly|get|set)\s+)*(?<name>[a-zA-Z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/gm,
      maxInlinedMembers: 6,
      maxTopLevel: 4,
    },
    {
      // Interfaces (TypeScript)
      kind: 'interface',
      priority: 2,
      regex: /^\s*(?:export\s+)?interface\s+(?<name>\w+)/gm,
      memberRegex: /^\s*(?:readonly\s+)?(?<name>[a-zA-Z_$][\w$?]*)\s*(?:<[^>]*>)?\s*(?:\(|:)/gm,
      maxInlinedMembers: 5,
      maxTopLevel: 3,
    },
    {
      // Type aliases (TypeScript)
      kind: 'type',
      priority: 3,
      regex: /^\s*(?:export\s+)?type\s+(?<name>\w+)\s*(?:<[^>]*>)?\s*=/gm,
      maxInlinedMembers: 0,
      maxTopLevel: 4,
    },
    {
      // Named function declarations and arrow function assignments
      kind: 'function',
      priority: 4,
      // function name( or const name = ... => or export function name(
      regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+(?<name>\w+)\s*(?:<[^>]*>)?\s*\(/gm,
      maxInlinedMembers: 0,
      maxTopLevel: 6,
    },
    {
      // Arrow functions assigned to const/let/var
      kind: 'function',
      priority: 4,
      regex: /^\s*(?:export\s+)?(?:const|let|var)\s+(?<name>[a-zA-Z_$][\w$]*)\s*(?::[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/gm,
      maxInlinedMembers: 0,
      maxTopLevel: 6,
    },
    {
      // Enum (TypeScript)
      kind: 'enum',
      priority: 5,
      regex: /^\s*(?:export\s+)?(?:const\s+)?enum\s+(?<name>\w+)/gm,
      maxInlinedMembers: 0,
      maxTopLevel: 3,
    },
    {
      // Constants: exported UPPER_CASE or PascalCase constants
      kind: 'constant',
      priority: 6,
      regex: /^\s*export\s+(?:const|var)\s+(?<name>[A-Z][A-Z0-9_]*|[A-Z]\w+)\s*(?::[^=]+)?\s*=/gm,
      maxInlinedMembers: 0,
      maxTopLevel: 5,
    },
  ],
};
