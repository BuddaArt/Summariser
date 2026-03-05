import * as fs from 'fs';
import * as path from 'path';
import { SummariserConfig } from './config';
import { FileEntry, scanDirectory } from './scanner';
import { summarizeFiles, FileSummary } from './summarizer';
import { summarizeFilesByPattern } from './pattern-summarizer';
import { loadAllFileCache, writeFileCache } from './project-cache';

export interface WatchCallbacks {
  onFileUpdated: (summary: FileSummary) => void;
  onError: (err: Error) => void;
}

/**
 * Dedup queue: maps a key (file path) to the latest scheduled task.
 * When a newer request arrives for the same key, the previous one is replaced.
 */
class DedupQueue {
  // key -> timer handle
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly debounceMs: number;

  constructor(debounceMs = 300) {
    this.debounceMs = debounceMs;
  }

  schedule(key: string, task: () => void): void {
    // Cancel the previous pending task for this key
    const existing = this.timers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    // Schedule the new task
    const handle = setTimeout(() => {
      this.timers.delete(key);
      task();
    }, this.debounceMs);
    this.timers.set(key, handle);
  }

  clear(): void {
    for (const handle of this.timers.values()) {
      clearTimeout(handle);
    }
    this.timers.clear();
  }
}

export interface WatchOptions {
  /** debounce delay in ms before processing a changed file */
  debounceMs?: number;
}

export function startWatcher(
  rootDir: string,
  config: SummariserConfig,
  callbacks: WatchCallbacks,
  opts: WatchOptions = {}
): () => void {
  const { debounceMs = 500 } = opts;
  const isPatternMode = config.summariseMode === 'pattern';
  const includeRegex = new RegExp(config.includePattern);
  const excludeRegex = new RegExp(config.excludePattern);

  // In-memory cache: absolutePath -> latest FileSummary
  // Seeded from global cache on startup
  const fileSummaryCache = new Map<string, FileSummary>();

  const persistedCache = loadAllFileCache();
  const initialFiles = scanDirectory(rootDir, {
    includePattern: config.includePattern,
    excludePattern: config.excludePattern,
  });
  for (const f of initialFiles) {
    const cached = persistedCache.get(f.absolutePath);
    if (cached !== undefined) {
      fileSummaryCache.set(f.absolutePath, { file: f, summary: cached, fromCache: true });
    }
  }

  const fileQueue = new DedupQueue(debounceMs);

  // Per-file task slot: at most one running task; any new request while running
  // just replaces the "pending" entry.
  interface FileTaskSlot {
    running: boolean;
    pendingEntry: FileEntry | null;
    waiters: Array<(summary: FileSummary) => void>;
  }
  const fileTaskSlots = new Map<string, FileTaskSlot>();

  async function runFileSummary(entry: FileEntry, slot: FileTaskSlot): Promise<void> {
    slot.running = true;
    slot.pendingEntry = null;
    try {
      let summary: FileSummary;
      if (isPatternMode) {
        const results = summarizeFilesByPattern([entry]);
        summary = results[0];
      } else {
        const results = await summarizeFiles(config, [entry], 1, undefined, false, config.cacheInFile, true);
        summary = results[0];
      }
      fileSummaryCache.set(entry.absolutePath, summary);
      if (!summary.error) {
        writeFileCache(entry.absolutePath, summary.summary);
      }
      callbacks.onFileUpdated(summary);

      const waiters = slot.waiters.splice(0);
      for (const resolve of waiters) resolve(summary);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      const waiters = slot.waiters.splice(0);
      for (const resolve of waiters) {
        const inMem = fileSummaryCache.get(entry.absolutePath);
        if (inMem) resolve(inMem);
      }
    } finally {
      slot.running = false;
      if (slot.pendingEntry !== null) {
        const next = slot.pendingEntry;
        runFileSummary(next, slot);
      } else {
        fileTaskSlots.delete(entry.absolutePath);
      }
    }
  }

  function scheduleFileSummary(entry: FileEntry): void {
    fileQueue.schedule(entry.absolutePath, () => {
      let slot = fileTaskSlots.get(entry.absolutePath);
      if (slot && slot.running) {
        slot.pendingEntry = entry;
        return;
      }
      if (!slot) {
        slot = { running: false, pendingEntry: null, waiters: [] };
        fileTaskSlots.set(entry.absolutePath, slot);
      }
      runFileSummary(entry, slot);
    });
  }

  function isTracked(filePath: string): boolean {
    const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const name = path.basename(filePath);
    if (excludeRegex.test(name) || excludeRegex.test(rel)) return false;
    return includeRegex.test(name);
  }

  // ── Initial scan: summarize files not yet in cache ───────────────────────────
  if (config.cacheInFile) {
    const uncached = initialFiles.filter(f => !fileSummaryCache.has(f.absolutePath));
    if (uncached.length > 0) {
      (async () => {
        try {
          let results: FileSummary[];
          if (isPatternMode) {
            results = summarizeFilesByPattern(uncached);
          } else {
            results = await summarizeFiles(
              config, uncached, config.concurrency,
              undefined, false, true, false
            );
          }
          for (const summary of results) {
            fileSummaryCache.set(summary.file.absolutePath, summary);
            if (!summary.error) {
              writeFileCache(summary.file.absolutePath, summary.summary);
            }
            callbacks.onFileUpdated(summary);
          }
        } catch (err) {
          callbacks.onError(err instanceof Error ? err : new Error(String(err)));
        }
      })();
    }
  }

  // Use recursive fs.watch (available in Node 18+)
  let watcher: fs.FSWatcher | null = null;
  try {
    watcher = fs.watch(rootDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const absolutePath = path.join(rootDir, filename);
      const relativePath = filename.replace(/\\/g, '/');

      if (!isTracked(absolutePath)) return;

      let stat: fs.Stats | null = null;
      try {
        stat = fs.statSync(absolutePath);
      } catch {
        // File deleted — remove from cache
        fileSummaryCache.delete(absolutePath);
        return;
      }

      if (!stat.isFile()) return;

      const entry: FileEntry = { absolutePath, relativePath };
      scheduleFileSummary(entry);
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }

  // Return stop function
  return () => {
    fileQueue.clear();
    watcher?.close();
  };
}
