/* <summariser>Run Setup Wizard with Config Saved</summariser> */
import { input, password, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { DEFAULT_CONFIG, SummariseMode, SummariserConfig, getConfigPath, loadConfig, saveConfig } from './config';
import { detectSystemLang, getT } from './i18n';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printBanner(t: ReturnType<typeof getT>): void {
  console.log(chalk.bold.cyan(t.banner));
}

function printSection(label: string): void {
  console.log('\n' + chalk.bold.white(label));
  console.log(chalk.gray('  ' + '─'.repeat(44)));
}

function hint(text: string): void {
  console.log(chalk.dim('  ' + text));
}

function printConfigRow(key: string, value: string, highlight = false): void {
  const k = chalk.cyan(key.padEnd(20));
  const v = highlight ? chalk.yellow(value) : chalk.white(value);
  console.log(`    ${k} ${v}`);
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export async function runSetupWizard(): Promise<void> {
  const lang = detectSystemLang();
  const t = getT(lang);

  // Clear + Banner
  console.clear();
  printBanner(t);

  console.log('\n' + chalk.bold.white(t.setupTitle));
  console.log(chalk.gray('  ' + t.setupSubtitle));
  console.log(chalk.dim(`\n  ${t.configSavedAt}: ${getConfigPath()}\n`));

  const existing = loadConfig();
  const hasExisting = !!existing.apiKey || existing.summariseMode === 'pattern';

  if (hasExisting) {
    console.log(chalk.dim('  ' + t.existingConfig + '\n'));
  }

  // ── Section 0: Mode ──────────────────────────────────────────────────────────
  printSection(t.sectionMode);

  hint(t.qModeHint);
  const summariseMode = await select<SummariseMode>({
    message: t.qMode,
    choices: [
      { name: t.modeLlm,     value: 'llm'     },
      { name: t.modePattern, value: 'pattern' },
    ],
    default: existing.summariseMode ?? DEFAULT_CONFIG.summariseMode,
  });

  // ── Section 1: Provider (LLM only) ──────────────────────────────────────────
  let apiKey = existing.apiKey;
  let baseURL = existing.baseURL || DEFAULT_CONFIG.baseURL;
  let model   = existing.model   || DEFAULT_CONFIG.model;
  let language = existing.language || DEFAULT_CONFIG.language;
  let maxTokens = existing.maxTokens ?? DEFAULT_CONFIG.maxTokens;
  let concurrency = existing.concurrency ?? DEFAULT_CONFIG.concurrency;
  let prompt = existing.prompt ?? DEFAULT_CONFIG.prompt;
  let cacheInFile = existing.cacheInFile ?? DEFAULT_CONFIG.cacheInFile;

  if (summariseMode === 'llm') {
    printSection(t.sectionProvider);

    hint(t.qBaseURLHint);
    baseURL = await input({
      message: t.qBaseURL,
      default: existing.baseURL || DEFAULT_CONFIG.baseURL,
    });

    console.log();
    const maskedKey = existing.apiKey
      ? `●●●●${existing.apiKey.slice(-4)}`
      : '';
    const apiKeyRaw = await password({
      message: existing.apiKey
        ? `${t.qApiKey} ${chalk.dim(`[${maskedKey}]`)} ${chalk.dim(t.leaveBlankToKeep ?? '(leave blank to keep)')}`
        : t.qApiKey,
      mask: '●',
      validate: (val: string) =>
        val.trim().length > 0 || !!existing.apiKey || t.errApiKeyEmpty,
    });
    apiKey = apiKeyRaw.trim() || existing.apiKey;

    // ── Section 2: Model ───────────────────────────────────────────────────────
    printSection(t.sectionModel);

    hint(t.qModelHint);
    model = await input({
      message: t.qModel,
      default: existing.model || DEFAULT_CONFIG.model,
    });

    console.log();
    const langChoiceVal = await select({
      message: t.qLanguage,
      choices: t.langChoices as unknown as Array<{ name: string; value: string }>,
      default: existing.language || t.langChoices[0].value,
    });

    language = langChoiceVal;
    if (langChoiceVal === '__custom__') {
      language = await input({
        message: t.qLanguageCustom,
        validate: (val: string) => val.trim().length > 0 || t.errApiKeyEmpty,
      });
    }

    // ── Section 4: Output ──────────────────────────────────────────────────────
    printSection(t.sectionOutput);

    hint(t.qMaxTokensHint);
    const maxTokensStr = await input({
      message: t.qMaxTokens,
      default: String(existing.maxTokens ?? DEFAULT_CONFIG.maxTokens),
      validate: (val: string) => {
        const n = parseInt(val, 10);
        return (!isNaN(n) && n > 0) || t.errPositiveNum;
      },
    });
    maxTokens = parseInt(maxTokensStr, 10);

    console.log();
    hint(t.qConcurrencyHint);
    const concurrencyStr = await input({
      message: t.qConcurrency,
      default: String(existing.concurrency ?? DEFAULT_CONFIG.concurrency),
      validate: (val: string) => {
        const n = parseInt(val, 10);
        return (!isNaN(n) && n > 0) || t.errPositiveNum;
      },
    });
    concurrency = parseInt(concurrencyStr, 10);

    // ── Section 5: Cache ─────────────────────────────────────────────────────
    printSection(t.sectionCache);

    hint(t.qCacheInFileHint);
    cacheInFile = await confirm({
      message: t.qCacheInFile,
      default: existing.cacheInFile ?? DEFAULT_CONFIG.cacheInFile,
    });

    // ── Section 6: Prompt ────────────────────────────────────────────────────
    printSection(t.sectionPrompt);

    hint(t.qPromptHint);
    prompt = await input({
      message: t.qPrompt,
      default: existing.prompt ?? DEFAULT_CONFIG.prompt,
    });
  }

  // ── Section 3: Filters (always shown) ───────────────────────────────────────
  printSection(t.sectionFilters);

  hint(t.qIncludeHint);
  const includePattern = await input({
    message: t.qInclude,
    default: existing.includePattern || DEFAULT_CONFIG.includePattern,
  });

  console.log();
  hint(t.qExcludeHint);
  const excludePattern = await input({
    message: t.qExclude,
    default: existing.excludePattern || DEFAULT_CONFIG.excludePattern,
  });

  // ── Preview ──────────────────────────────────────────────────────────────────
  console.log('\n\n' + chalk.bold.white(t.previewTitle));
  console.log(chalk.gray('  ' + '─'.repeat(44)));

  const config: SummariserConfig = {
    summariseMode,
    apiKey,
    baseURL,
    model,
    language,
    includePattern,
    excludePattern,
    maxTokens,
    concurrency,
    prompt,
    cacheInFile,
  };

  printConfigRow('summariseMode',   config.summariseMode, true);
  if (summariseMode === 'llm') {
    printConfigRow('apiKey',        t.keyHidden);
    printConfigRow('baseURL',       config.baseURL, config.baseURL !== DEFAULT_CONFIG.baseURL);
    printConfigRow('model',         config.model, true);
    printConfigRow('language',      config.language, true);
    printConfigRow('maxTokens',     String(config.maxTokens));
    printConfigRow('concurrency',   String(config.concurrency));
    printConfigRow('cacheInFile',   String(config.cacheInFile), config.cacheInFile);
    printConfigRow('prompt',        config.prompt ? config.prompt.slice(0, 40) + (config.prompt.length > 40 ? '…' : '') : '(built-in default)');
  }
  printConfigRow('includePattern', config.includePattern);
  printConfigRow('excludePattern', config.excludePattern);

  console.log();

  const confirmed = await confirm({
    message: t.confirmSave,
    default: true,
  });

  if (confirmed) {
    saveConfig(config);
    console.log('\n' + chalk.bold.green(t.saved) + '\n');
  } else {
    console.log('\n' + chalk.yellow(t.notSaved) + '\n');
  }
}
