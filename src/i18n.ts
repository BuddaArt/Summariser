/* <summariser>Саммари для анализа файлов проекта (ру/ен).</summariser> */

export type Lang = 'ru' | 'en';

export function detectSystemLang(): Lang {
  const env =
    process.env.LANG ||
    process.env.LANGUAGE ||
    process.env.LC_ALL ||
    process.env.LC_MESSAGES ||
    '';

  // Windows: check UI language via environment
  const winLang = process.env.USERLANG || '';

  const combined = (env + winLang).toLowerCase();

  if (combined.startsWith('ru')) return 'ru';

  // Fallback: check Windows locale via LOCALAPPDATA path heuristic (optional)
  // Most reliable cross-platform check is env vars above
  return 'en';
}

export const T = {
  en: {
    banner: `
  ╔═══════════════════════════════════════════════╗
  ║          S U M M A R I S E R                  ║
  ║      AI-powered project file summarizer       ║
  ╚═══════════════════════════════════════════════╝`,

    setupTitle: '  Setup Wizard',
    setupSubtitle: 'Answer a few questions to configure the tool.',
    configSavedAt: 'Config will be saved to',
    existingConfig: 'Existing config found — press Enter to keep current values.',

    sectionMode:     '  [ 0 / 6 ]  Mode',
    sectionProvider: '  [ 1 / 6 ]  Provider',
    sectionModel:    '  [ 2 / 6 ]  Model',
    sectionFilters:  '  [ 3 / 6 ]  Filters',
    sectionOutput:   '  [ 4 / 6 ]  Output',
    sectionCache:    '  [ 5 / 6 ]  Cache',
    sectionPrompt:   '  [ 6 / 6 ]  Prompt',

    qMode:        'Summarisation mode',
    qModeHint:    'llm = call AI model  |  pattern = regex extraction (no API key needed)',
    modeLlm:      'LLM  — AI-generated summaries (requires API key)',
    modePattern:  'Pattern — regex extraction, offline, instant',

    qApiKey:         'OpenAI-compatible API key',
    qBaseURL:        'API base URL (provider endpoint)',
    qBaseURLHint:    'e.g. https://api.openai.com/v1  or  https://api.together.ai/v1',
    qModel:          'Model name',
    qModelHint:      'e.g. gpt-4o-mini, mistral-7b, llama-3',
    qLanguage:       'Language for summaries',
    qLanguageCustom: 'Enter language name (e.g. Japanese)',
    qInclude:        'Include files matching regex',
    qIncludeHint:    'Matches file extensions — e.g. \\.(ts|js|py)$',
    qExclude:        'Exclude paths matching regex',
    qExcludeHint:    'Skips folders/files — e.g. (node_modules|dist)',
    qMaxTokens:      'Max tokens per summary',
    qMaxTokensHint:  'Keep low (50–200) for speed and cost efficiency',
    qConcurrency:    'Parallel requests to LLM',
    qConcurrencyHint:'Higher = faster but may hit rate limits',
    qCacheInFile:     'Cache summaries inside source files?',
    qCacheInFileHint: 'Writes a <summariser>…</summariser> comment at the top of each file — re-reads it on next run instead of calling the LLM',

    qPrompt:         'Custom summarizer prompt (leave empty to use built-in default)',
    qPromptHint:     'Placeholders: {{file}}, {{language}}, {{content}}',

    langChoices: [
      { name: 'English',  value: 'English'  },
      { name: 'Russian',  value: 'Russian'  },
      { name: 'Spanish',  value: 'Spanish'  },
      { name: 'German',   value: 'German'   },
      { name: 'French',   value: 'French'   },
      { name: 'Chinese',  value: 'Chinese'  },
      { name: 'Custom…',  value: '__custom__' },
    ],

    previewTitle:   '  Configuration preview',
    confirmSave:    'Save and apply this configuration?',
    saved:          '  ✓  Configuration saved!',
    notSaved:       '  ✗  Configuration not saved.',
    keyHidden:      '(hidden)',

    leaveBlankToKeep: 'leave blank to keep current',

    errApiKeyEmpty: 'API key cannot be empty',
    errPositiveNum: 'Must be a positive integer',

    noApiKey: '  Error: API key is not set.',
    noApiKeyHint: 'Run:  sum config init',

    welcomeBack: 'Ready. Analysing',
    firstRunHint: 'No configuration found. Starting setup wizard…',
  },

  ru: {
    banner: `
  ╔═══════════════════════════════════════════════╗
  ║          S U M M A R I S E R                  ║
  ║    AI-инструмент для анализа файлов проекта   ║
  ╚═══════════════════════════════════════════════╝`,

    setupTitle: '  Мастер настройки',
    setupSubtitle: 'Ответьте на несколько вопросов для настройки инструмента.',
    configSavedAt: 'Конфиг будет сохранён в',
    existingConfig: 'Найден существующий конфиг — нажмите Enter, чтобы сохранить текущие значения.',

    sectionMode:     '  [ 0 / 6 ]  Режим',
    sectionProvider: '  [ 1 / 6 ]  Провайдер',
    sectionModel:    '  [ 2 / 6 ]  Модель',
    sectionFilters:  '  [ 3 / 6 ]  Фильтры',
    sectionOutput:   '  [ 4 / 6 ]  Вывод',
    sectionCache:    '  [ 5 / 6 ]  Кэш',
    sectionPrompt:   '  [ 6 / 6 ]  Промпт',

    qMode:        'Режим саммаризации',
    qModeHint:    'llm = запрос к AI-модели  |  pattern = regex-извлечение (API-ключ не нужен)',
    modeLlm:      'LLM  — AI-саммари (требует API-ключ)',
    modePattern:  'Pattern — regex-извлечение, офлайн, мгновенно',

    qApiKey:         'API-ключ (совместимый с OpenAI)',
    qBaseURL:        'Базовый URL API (адрес провайдера)',
    qBaseURLHint:    'например https://api.openai.com/v1  или  https://api.together.ai/v1',
    qModel:          'Название модели',
    qModelHint:      'например gpt-4o-mini, mistral-7b, llama-3',
    qLanguage:       'Язык для саммари',
    qLanguageCustom: 'Введите название языка (например Japanese)',
    qInclude:        'Включать файлы по regex',
    qIncludeHint:    'Совпадение по расширению — например \\.(ts|js|py)$',
    qExclude:        'Исключать пути по regex',
    qExcludeHint:    'Пропускает папки/файлы — например (node_modules|dist)',
    qMaxTokens:      'Макс. токенов на одно саммари',
    qMaxTokensHint:  'Держите низким (50–200) для скорости и экономии',
    qConcurrency:    'Параллельных запросов к LLM',
    qConcurrencyHint:'Больше = быстрее, но может превысить лимит rate',
    qCacheInFile:     'Кэшировать саммари прямо в исходных файлах?',
    qCacheInFileHint: 'Вставляет комментарий <summariser>…</summariser> в начало каждого файла — при следующем запуске читает оттуда, а не обращается к LLM',

    qPrompt:         'Кастомный промпт саммарайзера (оставьте пустым для встроенного)',
    qPromptHint:     'Плейсхолдеры: {{file}}, {{language}}, {{content}}',

    langChoices: [
      { name: 'Русский',  value: 'Russian'  },
      { name: 'English',  value: 'English'  },
      { name: 'Испанский',value: 'Spanish'  },
      { name: 'Немецкий', value: 'German'   },
      { name: 'Французский', value: 'French' },
      { name: 'Китайский',value: 'Chinese'  },
      { name: 'Другой…',  value: '__custom__' },
    ],

    previewTitle:   '  Предпросмотр конфигурации',
    confirmSave:    'Сохранить и применить эту конфигурацию?',
    saved:          '  ✓  Конфигурация сохранена!',
    notSaved:       '  ✗  Конфигурация не сохранена.',
    keyHidden:      '(скрыто)',

    leaveBlankToKeep: 'оставьте пустым, чтобы сохранить текущий',

    errApiKeyEmpty: 'API-ключ не может быть пустым',
    errPositiveNum: 'Введите положительное целое число',

    noApiKey: '  Ошибка: API-ключ не задан.',
    noApiKeyHint: 'Выполните:  sum config init',

    welcomeBack: 'Начинаем анализ',
    firstRunHint: 'Конфигурация не найдена. Запускаем мастер настройки…',
  },
} as const;

export function getT(lang?: Lang) {
  const l = lang ?? detectSystemLang();
  return T[l];
}
