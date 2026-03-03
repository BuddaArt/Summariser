import * as fs from 'fs';
import * as path from 'path';

export interface FileEntry {
  absolutePath: string;
  relativePath: string;
}

export interface ScanOptions {
  includePattern: string;
  excludePattern: string;
}

export function scanDirectory(rootDir: string, options: ScanOptions): FileEntry[] {
  const includeRegex = new RegExp(options.includePattern);
  const excludeRegex = new RegExp(options.excludePattern);
  const results: FileEntry[] = [];

  function walk(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (excludeRegex.test(entry.name) || excludeRegex.test(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && includeRegex.test(entry.name)) {
        results.push({ absolutePath: fullPath, relativePath });
      }
    }
  }

  walk(rootDir);
  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return results;
}
