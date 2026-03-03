# summariser

CLI tool that scans a project directory and uses an OpenAI-compatible LLM to generate a brief per-file summary, then renders the result as a directory tree in the terminal.

```
- src
  -- cli       (entry point, wires Commander commands to analyse and config handlers)
  -- config    (OS-aware config file management, load/save/set helpers)
  -- scanner   (recursive directory walker with regex include/exclude filters)
  -- summarizer (OpenAI SDK calls with pool-based concurrency, progress callbacks)
  -- renderer  (builds directory tree from summaries and renders with chalk colors)
  -- setup     (interactive wizard for first-time configuration)
```

Works with any OpenAI-compatible API: OpenAI, OpenRouter, Groq, Ollama, etc.

---

# Model example:
- Qwen3.5-0.8B

## Install

**Option A — install from source** (requires Node.js v18+):

```bash
# Linux / macOS
bash install.sh

# Windows (PowerShell)
.\install.ps1

# Windows (cmd)
install.bat
```

The script installs dependencies, compiles TypeScript, and runs `npm link` so `sum` and `summariser` become available globally.

**Option B — pre-built binary** (no Node.js required):

Download the binary for your platform from Releases and put it anywhere on your `PATH`.

---

## Quick start

```bash
# 1. Configure once
sum config init

# 2. Run in any project
sum --path ./my-project
```

---

## Commands

| Command | Description |
|---|---|
| `sum` | Analyse current directory |
| `sum --path <dir>` | Analyse a specific directory |
| `sum --concurrency <n>` | Parallel LLM requests (default: 5) |
| `sum config init` | Interactive setup wizard |
| `sum config show` | Print current config |
| `sum config set <key> <value>` | Set a single config value |

---

## Configuration

Config is stored at:
- **Windows** — `%APPDATA%\summariser\summariser-config.json`
- **Linux / macOS** — `~/.config/summariser/summariser-config.json`

| Key | Default | Description |
|---|---|---|
| `apiKey` | — | OpenAI-compatible API key |
| `baseURL` | `https://api.openai.com/v1` | API base URL |
| `model` | `gpt-4o-mini` | Model name |
| `language` | `English` | Language for summaries |
| `includePattern` | `\.(ts\|js\|py\|go\|cs\|...)$` | Regex — which files to scan |
| `excludePattern` | `(node_modules\|.git\|dist\|...)` | Regex — which paths to skip |
| `maxTokens` | `150` | Max tokens per summary |

Examples:

```bash
sum config set apiKey sk-...
sum config set baseURL https://openrouter.ai/api/v1
sum config set model anthropic/claude-3-haiku
sum config set language Russian
sum config set includePattern "\\.(ts|js|py)$"
sum config set excludePattern "(node_modules|dist|\\.git|tests)"
```

---

## Build binaries

```bash
npm run build
npm run package:all   # → bin/sum-win.exe  bin/sum-linux  bin/sum-macos
```

Binaries are self-contained — no Node.js needed on the target machine.
