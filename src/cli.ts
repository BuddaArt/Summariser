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
  .option('-c, --concurrency <n>', 'Parallel LLM requests')
  .option('-v, --verbose', 'Print raw API responses and errors to stderr')
  .action(async (options: { path: string; concurrency: string; verbose?: boolean }) => {
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

    const targetDir = path.resolve(options.path);
    const concurrency = Math.max(1, parseInt(options.concurrency, 10) || config.concurrency);

    if (verbose) {
      console.log(chalk.bold(`\n  ${t.welcomeBack}: ${chalk.cyan(targetDir)}`));
      console.log(
        chalk.gray(`  Mode: ${isPatternMode ? 'pattern' : 'llm'}`) + '\n' +
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
        }, true, config.cacheInFile);
      } else {
        summaries = await summarizeFiles(config, files, concurrency, undefined, false, config.cacheInFile);
      }
    }

    if (verbose) {
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
      console.log(renderTreePlain(summaries));
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

    const targetDir = path.resolve(options.path);
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
  .description('Remove cached summaries from all matching files')
  .option('-p, --path <dir>', 'Directory to clear', process.cwd())
  .action((options: { path: string }) => {
    const config = loadConfig();
    const targetDir = path.resolve(options.path);
    const files = scanDirectory(targetDir, {
      includePattern: config.includePattern,
      excludePattern: config.excludePattern,
    });
    let cleared = 0;
    for (const file of files) {
      clearCache(file.absolutePath);
      cleared++;
    }
    console.log(chalk.green(`\n  Cleared cache from ${cleared} file(s) in ${chalk.cyan(targetDir)}\n`));
  });

// ─── Top-level init shortcut ───────────────────────────────────────────────────
program
  .command('init')
  .description('Run interactive configuration wizard (shortcut for config init)')
  .action(async () => {
    await runSetupWizard();
  });

program.parse(process.argv);
