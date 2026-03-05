import OpenAI from 'openai';
import * as fs from 'fs';
import { SummariserConfig } from './config';
import { FileEntry } from './scanner';
import { readCache, writeCache } from './cache';
import { readFileCache, writeFileCache, acquireFileLock, releaseFileLock, waitForFileLock } from './project-cache';

export interface FileSummary {
  file: FileEntry;
  summary: string;
  error?: string;
  fromCache?: boolean;
}

function readFileContent(filePath: string, maxChars = 8000): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.length > maxChars) {
      return content.slice(0, maxChars) + '\n\n[...file truncated...]';
    }
    return content;
  } catch {
    return '[Could not read file content]';
  }
}

const DEFAULT_PROMPT_TEMPLATE = `You are a code analysis assistant. Analyze the following source file and provide a single brief one-line summary (max 20 words).

File: {{file}}
Language for response: {{language}}

Rules:
- ONE line only, no newlines
- Describe PURPOSE and KEY RESPONSIBILITIES
- Descibe methods/functions/classes, not just file-level summary
- Be concise and direct

File content:
\`\`\`
{{content}}
\`\`\`

Summary:`;

function buildPrompt(relativePath: string, content: string, language: string, customPrompt?: string): string {
  const template = customPrompt || DEFAULT_PROMPT_TEMPLATE;
  return template
    .replace(/\{\{file\}\}/g, relativePath)
    .replace(/\{\{language\}\}/g, language)
    .replace(/\{\{content\}\}/g, content);
}

async function summarizeFile(
  client: OpenAI,
  config: SummariserConfig,
  file: FileEntry,
  useCache: boolean,
  verbose = false,
  useProjectCache = true
): Promise<FileSummary> {
  if (!useProjectCache) {
    // Legacy in-file cache only
    if (useCache) {
      const cached = readCache(file.absolutePath);
      if (cached !== null) return { file, summary: cached, fromCache: true };
    }
    return doSummarize();
  }

  // Cross-process lock: acquire first, then check cache inside the lock so we
  // never run two summarizations for the same file concurrently across processes.
  const locked = acquireFileLock(file.absolutePath);
  if (!locked) {
    // Another process holds the lock — wait for it to finish, then read its result.
    await waitForFileLock(file.absolutePath);
    const fresh = readFileCache(file.absolutePath);
    if (fresh !== null) return { file, summary: fresh, fromCache: true };
    // Other process errored and wrote nothing — acquire lock ourselves and summarize.
    return summarizeFile(client, config, file, useCache, verbose, useProjectCache);
  }

  try {
    // Inside the lock: always re-check cache — another process may have just written it.
    if (useCache) {
      const cached = readFileCache(file.absolutePath);
      if (cached !== null) return { file, summary: cached, fromCache: true };
    }
    return await doSummarize();
  } finally {
    releaseFileLock(file.absolutePath);
  }

  async function doSummarize(): Promise<FileSummary> {
    const content = readFileContent(file.absolutePath);
    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: buildPrompt(file.relativePath, content, config.language, config.prompt || undefined) }],
        max_tokens: config.maxTokens,
        temperature: 0.2,
      });
      if (verbose) {
        console.error(`\n[verbose] ${file.relativePath} response:`, JSON.stringify(response, null, 2));
      }
      const anyResponse = response as any;
      if (anyResponse.error) {
        throw new Error(typeof anyResponse.error === 'string' ? anyResponse.error : JSON.stringify(anyResponse.error));
      }
      if (!response.choices?.length) {
        throw new Error('Empty response from LLM (no choices returned)');
      }
      const raw = response.choices[0]?.message?.content ?? '';
      const summary = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'No summary generated';
      writeFileCache(file.absolutePath, summary);
      if (useCache && config.cacheInFile) {
        writeCache(file.absolutePath, summary);
      }
      return { file, summary };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      if (verbose) {
        console.error(`\n[verbose] ${file.relativePath} error:`, stack ?? message);
      }
      return { file, summary: '[Error generating summary]', error: message };
    }
  }
}

export async function summarizeFiles(
  config: SummariserConfig,
  files: FileEntry[],
  concurrency = 5,
  onProgress?: (completed: number, total: number, result: FileSummary) => void,
  verbose = false,
  useCache = false,
  forceRescan = false,
  useProjectCache = true
): Promise<FileSummary[]> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  if (verbose) {
    console.error(`\n[verbose] baseURL: ${config.baseURL}`);
    console.error(`[verbose] model: ${config.model}`);
    console.error(`[verbose] apiKey: ${config.apiKey ? '***' + config.apiKey.slice(-4) : '(not set)'}`);
    console.error(`[verbose] cacheInFile: ${useCache}`);
  }
  const results: FileSummary[] = [];
  const total = files.length;
  let completed = 0;
  const queue = [...files];

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      const result = await summarizeFile(client, config, file, useCache && !forceRescan, verbose, useProjectCache);
      results.push(result);
      completed++;
      onProgress?.(completed, total, result);
    }
  });

  await Promise.all(workers);

  const fileIndex = new Map(files.map((f, i) => [f.absolutePath, i]));
  results.sort(
    (a, b) => (fileIndex.get(a.file.absolutePath) ?? 0) - (fileIndex.get(b.file.absolutePath) ?? 0)
  );

  return results;
}
