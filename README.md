# summariser

CLI tool that scans a project directory and uses an OpenAI-compatible LLM to generate a brief per-file summary, then renders the result as a directory tree in the terminal.

```
src/
├── cli.ts          Entry point, Commander.js commands and orchestration
├── scanner.ts      Recursive file walker with regex include/exclude filters
├── summarizer.ts   OpenAI-compatible API pool with concurrency control
└── renderer.ts     Terminal tree output with chalk coloring
```

Works with any OpenAI-compatible API: OpenAI, OpenRouter, Groq, Ollama, LM Studio, etc.

Recommended model: `Qwen3.5-0.8B` — small and fast enough for summaries.

---

## Install

```bash
npm install summariser -g
```

## Setup

```bash
sumr config init
```

---

**Watch mode** — run once, stays up to date automatically:

```bash
sumr watch
```

New or changed files are re-summarized on the fly. Keep it running in the background while you work.

---

## Claude integration

Add to your `CLAUDE.md`:

```
* Always start ANY task with 'sumr -p ./... -d ...' to get an overview of the project structure.
Examples:
sumr -p ./src           # start from a specific folder
sumr -d 2               # show only 2 levels deep (like tree -L 2)
sumr -p ./src -d 1      # top-level folders with summaries
```

---

## Configuration

```bash
sumr config set apiKey sk-...
sumr config set baseURL https://openrouter.ai/api/v1
sumr config set model qwen3.5:0.8b
sumr config set language Russian
```

Config file location:
- **Windows** — `%APPDATA%\summariser\summariser-config.json`
- **Linux / macOS** — `~/.config/summariser/summariser-config.json`
