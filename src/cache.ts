import * as fs from 'fs';

// Comment delimiters by file extension
const COMMENT_STYLES: Record<string, { start: string; end: string } | { line: string }> = {
  // C-family, JS, TS, Java, Go, Rust, Swift, Kotlin, PHP
  ts: { start: '/*', end: '*/' },
  tsx: { start: '/*', end: '*/' },
  js: { start: '/*', end: '*/' },
  jsx: { start: '/*', end: '*/' },
  java: { start: '/*', end: '*/' },
  go: { start: '/*', end: '*/' },
  rs: { start: '/*', end: '*/' },
  swift: { start: '/*', end: '*/' },
  kt: { start: '/*', end: '*/' },
  kts: { start: '/*', end: '*/' },
  cpp: { start: '/*', end: '*/' },
  c: { start: '/*', end: '*/' },
  h: { start: '/*', end: '*/' },
  cs: { start: '/*', end: '*/' },
  php: { start: '/*', end: '*/' },
  // Python, Ruby, Shell, YAML, TOML
  py: { line: '#' },
  rb: { line: '#' },
  sh: { line: '#' },
  bash: { line: '#' },
  zsh: { line: '#' },
  yaml: { line: '#' },
  yml: { line: '#' },
  toml: { line: '#' },
  // HTML/XML style
  html: { start: '<!--', end: '-->' },
  htm: { start: '<!--', end: '-->' },
  xml: { start: '<!--', end: '-->' },
  svg: { start: '<!--', end: '-->' },
  // CSS
  css: { start: '/*', end: '*/' },
  scss: { start: '/*', end: '*/' },
  sass: { start: '/*', end: '*/' },
  less: { start: '/*', end: '*/' },
  // Lua
  lua: { start: '--[[', end: '--]]' },
  // SQL
  sql: { start: '/*', end: '*/' },
};

const TAG_OPEN = '<summariser>';
const TAG_CLOSE = '</summariser>';

function getExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function buildCacheComment(summary: string, style: { start: string; end: string } | { line: string }): string {
  if ('line' in style) {
    return `${style.line} ${TAG_OPEN}${summary}${TAG_CLOSE}`;
  }
  return `${style.start} ${TAG_OPEN}${summary}${TAG_CLOSE} ${style.end}`;
}

function parseCacheComment(line: string): string | null {
  const openIdx = line.indexOf(TAG_OPEN);
  const closeIdx = line.indexOf(TAG_CLOSE);
  if (openIdx === -1 || closeIdx === -1 || closeIdx <= openIdx) return null;
  return line.slice(openIdx + TAG_OPEN.length, closeIdx);
}

/** Read cached summary from the first few lines of a file. Returns null if not found. */
export function readCache(filePath: string): string | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  // Only check the first 5 lines for the cache comment
  const lines = content.split('\n').slice(0, 5);
  for (const line of lines) {
    const cached = parseCacheComment(line);
    if (cached !== null) return cached;
  }
  return null;
}

/** Write summary as a cache comment at the top of the file. */
export function writeCache(filePath: string, summary: string): void {
  const ext = getExtension(filePath);
  const style = COMMENT_STYLES[ext];
  if (!style) return; // Unknown extension — skip silently

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');

  // Remove any existing cache comment from the top (first 5 lines)
  const cleanLines = [...lines];
  for (let i = 0; i < Math.min(5, cleanLines.length); i++) {
    if (parseCacheComment(cleanLines[i]) !== null) {
      cleanLines.splice(i, 1);
      break;
    }
  }

  const comment = buildCacheComment(summary, style);
  cleanLines.unshift(comment);

  try {
    fs.writeFileSync(filePath, cleanLines.join('\n'), 'utf-8');
  } catch {
    // Ignore write errors (read-only files, permissions, etc.)
  }
}

/** Remove cache comment from the top of a file if present. */
export function clearCache(filePath: string): void {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (parseCacheComment(lines[i]) !== null) {
      lines.splice(i, 1);
      try {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
      } catch {
        // ignore
      }
      return;
    }
  }
}
