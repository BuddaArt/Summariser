#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  VALID_CONFIG_KEYS,
  SummariserConfig,
  getConfigPath,
  loadConfig,
  saveConfig,
  setConfigValue,
} from './config';
import { scanDirectory } from './scanner';
import { summarizeFiles } from './summarizer';
import { summarizeFilesByPattern } from './pattern-summarizer';
import { renderProgress, renderTree, renderTreePlain } from './renderer';
import { clearCache } from './cache';
import { runSetupWizard } from './setup';
import { detectSystemLang, getT } from './i18n';
import { startWatcher } from './watcher';
import { clearAllCache, getSumrDir, registerWatcher, listWatchers, unregisterWatcher, getWatcherLogsDir } from './project-cache';

const program = new Command();

program
  .name('summariser')
  .description('AI-powered project file summarizer')
  .version('1.0.0');

// ─── Main analyse command (default) ───────────────────────────────────────────
program
  .command('analyse', { isDefault: true })
  .description('Analyse project files and display summaries')
  .option('-p, --path <dir>', 'Directory to analyse', process.cwd())
  .option('-d, --depth <n>', 'Max depth of tree to display (like tree -L)')
  .option('-c, --concurrency <n>', 'Parallel LLM requests')
  .option('-v, --verbose', 'Print raw API responses and errors to stderr')
  .action(async (options: { path: string; depth?: string; concurrency: string; verbose?: boolean }) => {
    const lang = detectSystemLang();
    const t = getT(lang);
    const config = loadConfig();
    const verbose = !!options.verbose;

    const isPatternMode = config.summariseMode === 'pattern';

    if (!isPatternMode && !config.apiKey) {
      if (verbose) {
        console.log(chalk.bold.cyan(t.banner));
        console.log('\n' + chalk.yellow(t.firstRunHint) + '\n');
      }
      await runSetupWizard();
      return;
    }

    const targetDir = (() => { try { return fs.realpathSync(path.resolve(options.path)); } catch { return path.resolve(options.path); } })();
    const maxDepth = options.depth ? Math.max(1, parseInt(options.depth, 10) || Infinity) : Infinity;
    const concurrency = Math.max(1, parseInt(options.concurrency, 10) || config.concurrency);

    if (verbose) {
      console.log(chalk.bold(`\n  ${t.welcomeBack}: ${chalk.cyan(targetDir)}`));
      console.log(
        chalk.gray(`  Mode: ${isPatternMode ? 'pattern' : 'llm'}`) + '\n' +
        chalk.gray(`  Depth: ${maxDepth === Infinity ? 'all' : maxDepth}`) + '\n' +
        chalk.gray(`  Include: ${config.includePattern}`) + '\n' +
        chalk.gray(`  Exclude: ${config.excludePattern}`) + '\n'
      );
    }

    const files = scanDirectory(targetDir, {
      includePattern: config.includePattern,
      excludePattern: config.excludePattern,
    });

    if (files.length === 0) {
      if (verbose) {
        console.log(chalk.yellow('  No matching files found.\n'));
      }
      process.exit(0);
    }

    if (verbose) {
      console.log(chalk.gray(`  Found ${files.length} file(s) to summarize.\n`));
    }

    let summaries;

    if (isPatternMode) {
      if (verbose) {
        process.stdout.write(renderProgress(0, files.length, ''));
        summaries = summarizeFilesByPattern(files, (completed, total, result) => {
          process.stdout.write(renderProgress(completed, total, result.file.relativePath));
        });
      } else {
        summaries = summarizeFilesByPattern(files);
      }
    } else {
      if (verbose) {
        process.stdout.write(renderProgress(0, files.length, ''));
        summaries = await summarizeFiles(config, files, concurrency, (completed, total, result) => {
          process.stdout.write(renderProgress(completed, total, result.file.relativePath));
        }, true, config.cacheInFile, false);
      } else {
        summaries = await summarizeFiles(config, files, concurrency, undefined, false, config.cacheInFile, false);
      }
    }

    if (verbose) {
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      console.log('\n' + renderTree(summaries, undefined, maxDepth) + '\n');

      const errors = summaries.filter((s) => s.error);
      if (errors.length > 0) {
        console.log(chalk.yellow(`  ${errors.length} file(s) had errors during summarization:`));
        for (const s of errors) {
          console.log(chalk.gray(`    ${s.file.relativePath}: `) + chalk.red(s.error));
        }
        console.log();
      }
    } else {
      console.log(renderTreePlain(summaries, undefined, maxDepth));
    }
  });

// ─── rescan command ────────────────────────────────────────────────────────────
program
  .command('rescan')
  .description('Re-summarize all files, ignoring and overwriting any cached summaries')
  .option('-p, --path <dir>', 'Directory to analyse', process.cwd())
  .option('-c, --concurrency <n>', 'Parallel LLM requests')
  .option('-v, --verbose', 'Print raw API responses and errors to stderr')
  .action(async (options: { path: string; concurrency: string; verbose?: boolean }) => {
    const lang = detectSystemLang();
    const t = getT(lang);
    const config = loadConfig();
    const verbose = !!options.verbose;

    if (!config.apiKey) {
      if (verbose) {
        console.log(chalk.bold.cyan(t.banner));
        console.log('\n' + chalk.yellow(t.firstRunHint) + '\n');
      }
      await runSetupWizard();
      return;
    }

    const targetDir = (() => { try { return fs.realpathSync(path.resolve(options.path)); } catch { return path.resolve(options.path); } })();
    const concurrency = Math.max(1, parseInt(options.concurrency, 10) || config.concurrency);

    if (verbose) {
      console.log(chalk.bold(`\n  Rescan: ${chalk.cyan(targetDir)}`));
      console.log(
        chalk.gray(`  Cache: ${config.cacheInFile ? 'will overwrite' : 'disabled (enable with config set cacheInFile true)'}`) + '\n' +
        chalk.gray(`  Include: ${config.includePattern}`) + '\n' +
        chalk.gray(`  Exclude: ${config.excludePattern}`) + '\n'
      );
    }

    const files = scanDirectory(targetDir, {
      includePattern: config.includePattern,
      excludePattern: config.excludePattern,
    });

    if (files.length === 0) {
      if (verbose) {
        console.log(chalk.yellow('  No matching files found.\n'));
      }
      process.exit(0);
    }

    if (verbose) {
      console.log(chalk.gray(`  Found ${files.length} file(s) to re-summarize.\n`));
    }

    // forceRescan=true skips reading cache; writeCache still runs if cacheInFile is enabled
    let summaries;
    if (verbose) {
      process.stdout.write(renderProgress(0, files.length, ''));
      summaries = await summarizeFiles(
        config, files, concurrency,
        (completed, total, result) => {
          process.stdout.write(renderProgress(completed, total, result.file.relativePath));
        },
        true,
        config.cacheInFile,
        true,
      );
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      console.log('\n' + renderTree(summaries) + '\n');

      const errors = summaries.filter((s) => s.error);
      if (errors.length > 0) {
        console.log(chalk.yellow(`  ${errors.length} file(s) had errors during summarization:`));
        for (const s of errors) {
          console.log(chalk.gray(`    ${s.file.relativePath}: `) + chalk.red(s.error));
        }
        console.log();
      }
    } else {
      summaries = await summarizeFiles(
        config, files, concurrency,
        undefined, false, config.cacheInFile, true,
      );
      for (const s of summaries) {
        process.stdout.write(`${s.file.relativePath}: ${s.summary}\n`);
      }
    }
  });

// ─── config command group ──────────────────────────────────────────────────────
const configCmd = program
  .command('config')
  .description('Manage summariser configuration');

configCmd
  .command('set <key> <value>')
  .description(`Set a configuration value. Valid keys: ${VALID_CONFIG_KEYS.join(', ')}`)
  .action((key: string, value: string) => {
    if (!VALID_CONFIG_KEYS.includes(key as keyof SummariserConfig)) {
      console.error(
        chalk.red(`\n  Error: Unknown config key "${key}"`) +
        chalk.gray(`\n  Valid keys: ${VALID_CONFIG_KEYS.join(', ')}\n`)
      );
      process.exit(1);
    }
    try {
      setConfigValue(key as keyof SummariserConfig, value);
      const displayValue = key === 'apiKey' ? '***' : value;
      console.log(chalk.green(`\n  Set ${chalk.cyan(key)} = ${displayValue}\n`));
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${err}\n`));
      process.exit(1);
    }
  });

configCmd
  .command('show')
  .description('Display current configuration')
  .action(() => {
    const config = loadConfig();
    console.log(chalk.bold(`\n  Config: ${chalk.gray(getConfigPath())}\n`));
    const display = {
      ...config,
      apiKey: config.apiKey ? '●●●' + config.apiKey.slice(-4) : chalk.red('(not set)'),
    };
    for (const [key, value] of Object.entries(display)) {
      console.log(`  ${chalk.cyan(key.padEnd(18))} ${chalk.white(String(value))}`);
    }
    console.log();
  });

configCmd
  .command('init')
  .description('Run interactive configuration wizard')
  .action(async () => {
    await runSetupWizard();
  });

configCmd
  .command('prompt')
  .description('Edit the summarizer prompt in $EDITOR (uses {{file}}, {{language}}, {{content}} placeholders)')
  .option('--show', 'Print current prompt without editing')
  .option('--reset', 'Reset prompt to built-in default')
  .action((options: { show?: boolean; reset?: boolean }) => {
    const config = loadConfig();

    if (options.reset) {
      config.prompt = '';
      saveConfig(config);
      console.log(chalk.green('\n  Prompt reset to built-in default.\n'));
      return;
    }

    if (options.show) {
      if (config.prompt) {
        console.log(chalk.bold('\n  Custom prompt:\n'));
        console.log(config.prompt);
      } else {
        console.log(chalk.gray('\n  No custom prompt set (using built-in default).\n'));
      }
      return;
    }

    const editor = process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad' : 'nano');
    const tmpFile = path.join(os.tmpdir(), 'summariser-prompt.txt');
    const placeholder = `# Edit your summarizer prompt below.
# Available placeholders: {{file}}, {{language}}, {{content}}
# Lines starting with # are stripped. Save and close to apply.
# Leave empty to use the built-in default.

${config.prompt}`;
    fs.writeFileSync(tmpFile, placeholder, 'utf-8');

    try {
      execSync(`${editor} "${tmpFile}"`, { stdio: 'inherit' });
    } catch {
      console.error(chalk.red(`\n  Failed to open editor: ${editor}\n  Set $EDITOR env variable to your preferred editor.\n`));
      process.exit(1);
    }

    const raw = fs.readFileSync(tmpFile, 'utf-8');
    const newPrompt = raw
      .split('\n')
      .filter(line => !line.startsWith('#'))
      .join('\n')
      .trim();

    config.prompt = newPrompt;
    saveConfig(config);

    if (newPrompt) {
      console.log(chalk.green('\n  Custom prompt saved.\n'));
    } else {
      console.log(chalk.green('\n  Prompt cleared — will use built-in default.\n'));
    }
  });

// ─── clear command ─────────────────────────────────────────────────────────────
program
  .command('clear')
  .description('Remove cached summaries (.sumr/ project cache and in-file comments)')
  .option('-p, --path <dir>', 'Directory to clear', process.cwd())
  .option('--no-sumr', 'Skip clearing .sumr/ project cache')
  .option('--no-inline', 'Skip clearing in-file cache comments')
  .action((options: { path: string; sumr: boolean; inline: boolean }) => {
    const config = loadConfig();
    const targetDir = path.resolve(options.path);

    // Clear .sumr/ project cache
    if (options.sumr) {
      const sumrDir = getSumrDir();
      clearAllCache();
      console.log(chalk.green(`\n  Cleared .sumr/ cache: ${chalk.cyan(sumrDir)}`));
    }

    // Clear in-file cache comments
    if (options.inline) {
      const files = scanDirectory(targetDir, {
        includePattern: config.includePattern,
        excludePattern: config.excludePattern,
      });
      let cleared = 0;
      for (const file of files) {
        clearCache(file.absolutePath);
        cleared++;
      }
      console.log(chalk.green(`  Cleared in-file cache from ${cleared} file(s)`));
    }

    console.log();
  });

// ─── Top-level init shortcut ───────────────────────────────────────────────────
program
  .command('init')
  .description('Run interactive configuration wizard (shortcut for config init)')
  .action(async () => {
    await runSetupWizard();
  });

// ─── watch command ─────────────────────────────────────────────────────────────
const watchCmd = program
  .command('watch')
  .description('Watch project files for changes and update summaries automatically')
  .option('-p, --path <dir>', 'Directory to watch', process.cwd())
  .option('--detach', 'Run watcher in background (daemonize)')
  .action(async (options: { path: string; detach?: boolean }) => {
    const config = loadConfig();

    if (config.summariseMode !== 'pattern' && !config.apiKey) {
      await runSetupWizard();
      return;
    }

    const targetDir = (() => { try { return fs.realpathSync(path.resolve(options.path)); } catch { return path.resolve(options.path); } })();

    // ── Detach mode ──────────────────────────────────────────────────────────
    if (options.detach) {
      const { spawn } = await import('child_process');
      const logsDir = getWatcherLogsDir();
      const logFile = path.join(logsDir, `watch-${Date.now()}.log`);
      const logFd = fs.openSync(logFile, 'a');

      const childArgs: string[] = ['watch', '-p', targetDir];

      const child = spawn(process.execPath, [process.argv[1], ...childArgs], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
      });
      child.unref();

      const entry = registerWatcher(child.pid!, targetDir, logFile);
      console.log(chalk.bold(`\n  Watcher started in background`));
      console.log(chalk.gray(`  ID  : ${entry.id}`));
      console.log(chalk.gray(`  PID : ${child.pid}`));
      console.log(chalk.gray(`  Dir : ${targetDir}`));
      console.log(chalk.gray(`  Log : ${logFile}`));
      console.log(chalk.gray(`\n  Use "summariser watch list" to see active watchers.`));
      console.log(chalk.gray(`  Use "summariser watch stop ${entry.id}" to stop it.\n`));
      return;
    }

    // ── Foreground mode ──────────────────────────────────────────────────────
    console.log(chalk.bold(`\n  Watching: ${chalk.cyan(targetDir)}`));
    console.log(chalk.gray('  Press Ctrl+C to stop.\n'));

    const stop = startWatcher(targetDir, config, {
      onFileUpdated: (summary) => {
        const hasError = !!summary.error;
        const nameStr = chalk.hex('#FF8C00').bold(summary.file.relativePath);
        const summaryStr = hasError ? chalk.red(summary.summary) : chalk.dim(summary.summary);
        const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
        const src = summary.fromCache ? chalk.cyan('[cache]') : chalk.magenta('[llm]');
        console.log(`${chalk.gray('[file]')} ${chalk.gray(ts)} ${src} ${nameStr}  ${summaryStr}`);
      },
      onError: (err) => {
        console.error(chalk.red(`[error] ${err.message}`));
      },
    });

    process.on('SIGINT', () => {
      stop();
      console.log(chalk.gray('\n  Watcher stopped.\n'));
      process.exit(0);
    });

    // Keep process alive
    await new Promise<void>(() => { /* runs until SIGINT */ });
  });

// ─── watch list ────────────────────────────────────────────────────────────────
watchCmd
  .command('list')
  .description('List active background watchers')
  .action(() => {
    const entries = listWatchers();
    if (entries.length === 0) {
      console.log(chalk.gray('\n  No active background watchers.\n'));
      return;
    }
    console.log(chalk.bold(`\n  Active watchers:\n`));
    for (const e of entries) {
      console.log(
        `  ${chalk.cyan(e.id.padEnd(4))} ` +
        `${chalk.gray('pid:')} ${String(e.pid).padEnd(8)} ` +
        `${chalk.hex('#FF8C00')(e.dir)}`
      );
      console.log(chalk.gray(`       started: ${e.startedAt}   log: ${e.logFile}`));
    }
    console.log();
  });

// ─── watch stop ────────────────────────────────────────────────────────────────
watchCmd
  .command('stop <id>')
  .description('Stop a background watcher by its ID (see "watch list")')
  .action((id: string) => {
    const entries = listWatchers();
    const entry = entries.find(e => e.id === id || String(e.pid) === id);
    if (!entry) {
      console.error(chalk.red(`\n  No watcher with ID "${id}". Run "summariser watch list" to see active watchers.\n`));
      process.exit(1);
    }
    try {
      process.kill(entry.pid, 'SIGINT');
    } catch {
      // process may have already died
    }
    unregisterWatcher(id);
    console.log(chalk.green(`\n  Stopped watcher ${id} (pid ${entry.pid}) watching ${entry.dir}\n`));
  });

program.parse(process.argv);
