/**
 * Global user-level cache stored outside any project directory.
 *
 * Location (OS-conventional):
 *   Windows  : %APPDATA%\summariser\cache\
 *   macOS    : ~/Library/Caches/summariser/
 *   Linux    : ~/.cache/summariser/
 *
 * Layout:
 *   files/<fileHash>.json    — one file per source file (keyed by absolute path)
 *   folders/<folderHash>.json — one file per folder (keyed by absolute folder path)
 *
 * File cache entry  : { absolutePath, summary, mtime, updatedAt }
 * Folder cache entry: { absolutePath, summary, updatedAt }
 *
 * Stale detection for files: if mtime on disk != stored mtime → invalidated.
 * Folder entries are invalidated explicitly when a contained file changes.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// ─── Paths ────────────────────────────────────────────────────────────────────

function getBaseDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error('APPDATA environment variable not set');
    return path.join(appData, 'summariser', 'cache');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'summariser');
  }
  // XDG-compliant Linux default
  const xdgCache = process.env.XDG_CACHE_HOME;
  return path.join(xdgCache ?? path.join(os.homedir(), '.cache'), 'summariser');
}

/** Short, filesystem-safe hash of a string (first 16 hex chars of SHA-256). */
function hash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function getFilesDir(): string {
  return path.join(getBaseDir(), 'files');
}

function getLocksDir(): string {
  return path.join(getBaseDir(), 'locks');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── File cache ───────────────────────────────────────────────────────────────

interface FileCacheEntry {
  absolutePath: string;
  summary: string;
  mtime: number;
  updatedAt: string;
}

function fileEntryPath(absolutePath: string): string {
  return path.join(getFilesDir(), hash(absolutePath) + '.json');
}

function readFileEntry(absolutePath: string): FileCacheEntry | null {
  const p = fileEntryPath(absolutePath);
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as FileCacheEntry;
  } catch {
    return null;
  }
}

function writeFileEntry(entry: FileCacheEntry): void {
  const dir = getFilesDir();
  ensureDir(dir);
  const p = fileEntryPath(entry.absolutePath);
  try {
    fs.writeFileSync(p, JSON.stringify(entry, null, 2), 'utf-8');
  } catch {
    // ignore write errors
  }
}

/**
 * Read a cached file summary.
 * Returns null if not cached or stale (mtime changed or file gone).
 */
export function readFileCache(absolutePath: string): string | null {
  const entry = readFileEntry(absolutePath);
  if (!entry) return null;

  try {
    const stat = fs.statSync(absolutePath);
    if (Math.floor(stat.mtimeMs) !== entry.mtime) return null;
  } catch {
    return null;
  }

  return entry.summary;
}

/**
 * Write a file summary to the global cache.
 */
export function writeFileCache(absolutePath: string, summary: string): void {
  let mtime = 0;
  try {
    mtime = Math.floor(fs.statSync(absolutePath).mtimeMs);
  } catch { /* store 0, will be stale next read */ }

  writeFileEntry({
    absolutePath,
    summary,
    mtime,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Remove a single file entry from the cache.
 */
export function clearFileCache(absolutePath: string): void {
  const p = fileEntryPath(absolutePath);
  try { fs.rmSync(p, { force: true }); } catch { /* ignore */ }
}

/**
 * Load all valid (non-stale) file summaries from the global cache.
 * Returns a Map<absolutePath, summary>.
 */
export function loadAllFileCache(): Map<string, string> {
  const dir = getFilesDir();
  const result = new Map<string, string>();
  if (!fs.existsSync(dir)) return result;

  let entries: string[];
  try {
    entries = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch {
    return result;
  }

  for (const file of entries) {
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as FileCacheEntry;
      const stat = fs.statSync(entry.absolutePath);
      if (Math.floor(stat.mtimeMs) === entry.mtime) {
        result.set(entry.absolutePath, entry.summary);
      }
    } catch {
      // stale or unreadable — skip
    }
  }

  return result;
}

/**
 * Wipe the entire global cache (files + folders + locks).
 */
export function clearAllCache(): void {
  const base = getBaseDir();
  for (const sub of ['files', 'folders', 'locks']) {
    const dir = path.join(base, sub);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

/**
 * Return the cache base directory path (for display purposes).
 */
export function getSumrDir(): string {
  return getBaseDir();
}

// ─── Background watcher registry ─────────────────────────────────────────────

export interface WatcherEntry {
  id: string;       // short numeric id, e.g. "1"
  pid: number;
  dir: string;
  startedAt: string;
  logFile: string;
}

function getWatchersFile(): string {
  const base = getBaseDir();
  ensureDir(base);
  return path.join(base, 'watchers.json');
}

function readWatchers(): WatcherEntry[] {
  const f = getWatchersFile();
  try {
    if (!fs.existsSync(f)) return [];
    return JSON.parse(fs.readFileSync(f, 'utf-8')) as WatcherEntry[];
  } catch {
    return [];
  }
}

function writeWatchers(entries: WatcherEntry[]): void {
  fs.writeFileSync(getWatchersFile(), JSON.stringify(entries, null, 2), 'utf-8');
}

/** Remove entries whose processes are no longer alive. */
function pruneWatchers(entries: WatcherEntry[]): WatcherEntry[] {
  return entries.filter(e => {
    try { process.kill(e.pid, 0); return true; } catch { return false; }
  });
}

/** Register a new background watcher. Returns the assigned entry. */
export function registerWatcher(pid: number, dir: string, logFile: string): WatcherEntry {
  const base = getBaseDir();
  ensureDir(base);
  let entries = pruneWatchers(readWatchers());
  // Pick next available id
  const usedIds = new Set(entries.map(e => parseInt(e.id, 10)));
  let nextId = 1;
  while (usedIds.has(nextId)) nextId++;
  const entry: WatcherEntry = { id: String(nextId), pid, dir, startedAt: new Date().toISOString(), logFile };
  entries.push(entry);
  writeWatchers(entries);
  return entry;
}

/** Remove a watcher entry by id or pid. Returns true if found. */
export function unregisterWatcher(idOrPid: string | number): boolean {
  let entries = readWatchers();
  const before = entries.length;
  entries = entries.filter(e => e.id !== String(idOrPid) && e.pid !== Number(idOrPid));
  writeWatchers(pruneWatchers(entries));
  return entries.length < before;
}

/** List all currently-alive watcher entries. */
export function listWatchers(): WatcherEntry[] {
  const entries = pruneWatchers(readWatchers());
  writeWatchers(entries); // clean up stale entries
  return entries;
}

/** Return the log directory for background watchers. */
export function getWatcherLogsDir(): string {
  const dir = path.join(getBaseDir(), 'watcher-logs');
  ensureDir(dir);
  return dir;
}

// ─── File-level cross-process locks ──────────────────────────────────────────
//
// Lock file location: locks/<fileHash>.lock
// Content: JSON { pid: number, acquiredAt: number }
//
// Stale if: pid is dead OR acquiredAt is older than LOCK_STALE_MS.
// Acquiring: atomic O_EXCL open — only one process wins.
// Waiting: poll every LOCK_POLL_MS until lock disappears, then read from cache.

const LOCK_STALE_MS = 120_000; // 2 min — max time a summarization should take
const LOCK_POLL_MS  = 200;

interface LockEntry { pid: number; acquiredAt: number; }

function lockFilePath(key: string): string {
  return path.join(getLocksDir(), hash(key) + '.lock');
}

function isLockStale(entry: LockEntry): boolean {
  if (Date.now() - entry.acquiredAt > LOCK_STALE_MS) return true;
  try { process.kill(entry.pid, 0); return false; } catch { return true; }
}

function tryBreakStaleLock(lockPath: string): void {
  try {
    const entry = JSON.parse(fs.readFileSync(lockPath, 'utf-8')) as LockEntry;
    if (isLockStale(entry)) fs.rmSync(lockPath, { force: true });
  } catch { /* already gone or unreadable */ }
}

/**
 * Try to acquire a cross-process lock for a file (keyed by absolute path).
 * Returns true if the lock was acquired, false if another process holds it.
 */
export function acquireFileLock(absolutePath: string): boolean {
  const dir = getLocksDir();
  ensureDir(dir);
  const lockPath = lockFilePath(absolutePath);

  // Break stale lock before trying
  tryBreakStaleLock(lockPath);

  try {
    const fd = fs.openSync(lockPath, 'wx'); // O_EXCL — fails if file exists
    const entry: LockEntry = { pid: process.pid, acquiredAt: Date.now() };
    fs.writeSync(fd, JSON.stringify(entry));
    fs.closeSync(fd);
    return true;
  } catch {
    return false; // another process holds the lock
  }
}

/**
 * Release a previously acquired lock.
 */
export function releaseFileLock(absolutePath: string): void {
  const lockPath = lockFilePath(absolutePath);
  try { fs.rmSync(lockPath, { force: true }); } catch { /* ignore */ }
}

/**
 * Wait until the lock for a file is released (or goes stale), then return.
 * Call this when acquireFileLock returned false — the caller should then
 * read the result from cache instead of re-running the summarizer.
 */
export async function waitForFileLock(
  absolutePath: string,
  timeoutMs = LOCK_STALE_MS
): Promise<void> {
  const lockPath = lockFilePath(absolutePath);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!fs.existsSync(lockPath)) return;
    tryBreakStaleLock(lockPath);
    if (!fs.existsSync(lockPath)) return;
    await new Promise<void>(res => setTimeout(res, LOCK_POLL_MS));
  }
  // Timeout — force-break the lock so we don't block forever
  fs.rmSync(lockPath, { force: true });
}
