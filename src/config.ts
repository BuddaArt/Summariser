/* <summariser>Summariser config with llm/pattern modes and configurable keys.</summariser> */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type SummariseMode = 'llm' | 'pattern';

export interface SummariserConfig {
  summariseMode: SummariseMode;
  apiKey: string;
  baseURL: string;
  model: string;
  language: string;
  includePattern: string;
  excludePattern: string;
  maxTokens: number;
  concurrency: number;
  prompt: string;
  cacheInFile: boolean;
}

export const DEFAULT_CONFIG: SummariserConfig = {
  summariseMode: 'llm',
  apiKey: '',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  language: 'English',
  includePattern: '\\.(ts|tsx|js|jsx|py|go|cs|java|rb|rs|cpp|c|h|php|swift|kt)$',
  excludePattern: '(node_modules|\\.git|dist|build|bin|obj|vendor|\\.next|__pycache__|\\.venv)',
  maxTokens: 150,
  concurrency: 5,
  prompt: '',
  cacheInFile: false,
};

export const VALID_CONFIG_KEYS: Array<keyof SummariserConfig> = [
  'summariseMode',
  'apiKey',
  'baseURL',
  'model',
  'language',
  'includePattern',
  'excludePattern',
  'maxTokens',
  'concurrency',
  'prompt',
  'cacheInFile',
];

export function getConfigDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error('APPDATA environment variable not set');
    return path.join(appData, 'summariser');
  }
  return path.join(os.homedir(), '.config', 'summariser');
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'summariser-config.json');
}

export function loadConfig(): SummariserConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SummariserConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    throw new Error(`Failed to parse config at ${configPath}: ${err}`);
  }
}

export function saveConfig(config: SummariserConfig): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

export function setConfigValue(key: keyof SummariserConfig, value: string): void {
  const config = loadConfig();
  if (key === 'maxTokens' || key === 'concurrency') {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      throw new Error(`${key} must be a positive number, got: ${value}`);
    }
    config[key] = num;
  } else if (key === 'cacheInFile') {
    if (value !== 'true' && value !== 'false') {
      throw new Error(`cacheInFile must be "true" or "false", got: ${value}`);
    }
    config.cacheInFile = value === 'true';
  } else if (key === 'summariseMode') {
    if (value !== 'llm' && value !== 'pattern') {
      throw new Error(`summariseMode must be "llm" or "pattern", got: ${value}`);
    }
    config.summariseMode = value as SummariseMode;
  } else {
    (config as unknown as Record<string, string | number>)[key] = value;
  }
  saveConfig(config);
}
