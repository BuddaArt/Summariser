/* <summariser>Pattern Set for C#/dotnet with regex-based matching and priority rules.</summariser> */
import { PatternSet } from '../types';

// ─── .NET / C# Pattern Set ────────────────────────────────────────────────────

export const dotnetPatterns: PatternSet = {
  language: 'dotnet',
  fileExtensions: ['cs'],
  rules: [
    {
      // Classes and structs — highest priority
      kind: 'class',
      priority: 1,
      // matches: public/internal/private/protected (partial/abstract/sealed/static) class|struct|record Name
      regex: /^\s*(?:(?:public|internal|private|protected|file)\s+)?(?:(?:partial|abstract|sealed|static|readonly)\s+)*(?:class|struct|record(?:\s+struct)?)\s+(?<name>\w+)/gm,
      // methods: public/private/... ReturnType MethodName(
      memberRegex: /^\s*(?:(?:public|private|protected|internal|override|virtual|abstract|static|async|new|sealed)\s+)+(?:[\w<>\[\]?,\s]+)\s+(?<name>[A-Z]\w+)\s*(?:<[^>]*>)?\s*\(/gm,
      maxInlinedMembers: 6,
      maxTopLevel: 4,
    },
    {
      // Interfaces — second priority
      kind: 'interface',
      priority: 2,
      regex: /^\s*(?:(?:public|internal|private|protected|file)\s+)?(?:partial\s+)?interface\s+(?<name>\w+)/gm,
      memberRegex: /^\s*(?:(?:[\w<>\[\]?,\s]+)\s+)?(?<name>[A-Z]\w+)\s*(?:<[^>]*>)?\s*\(/gm,
      maxInlinedMembers: 5,
      maxTopLevel: 3,
    },
    {
      // Enums
      kind: 'enum',
      priority: 3,
      regex: /^\s*(?:(?:public|internal|private|protected|file)\s+)?enum\s+(?<name>\w+)/gm,
      maxInlinedMembers: 0,
      maxTopLevel: 3,
    },
    {
      // Top-level functions / static methods at file level (rare in C# but valid in top-level programs)
      kind: 'function',
      priority: 4,
      regex: /^(?:(?:public|private|internal|static|async)\s+)+(?:[\w<>\[\]?,]+\s+)+(?<name>[A-Z]\w+)\s*\(/gm,
      maxInlinedMembers: 0,
      maxTopLevel: 5,
    },
    {
      // Constants
      kind: 'constant',
      priority: 5,
      regex: /\bconst\s+(?:[\w<>\[\]]+\s+)+(?<name>[A-Z_][A-Z0-9_]*)\s*=/gm,
      maxInlinedMembers: 0,
      maxTopLevel: 4,
    },
  ],
};
