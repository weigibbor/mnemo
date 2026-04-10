<p align="center">
  <img src="assets/mnemo-logo-full.svg" alt="mnemo" height="48">
</p>

<p align="center">
  Persistent memory for your AI coding tools. Never re-explain your project again.
</p>

<p align="center">
  <strong>Zero-config · TypeScript-native · Dev-tool-specific · Auto-capture</strong>
</p>

Every AI session starts blank. Decisions, architecture choices, failed approaches — gone when you close the terminal. **mnemo** watches your sessions, extracts what matters, and injects it back into any AI tool at session start.

### Why mnemo?

- **Zero-config** — `npx mnemo-ai init` and you're done. No YAML, no dashboard, no setup wizard.
- **TypeScript-native** — built in TypeScript, for TypeScript developers. First-class MCP support.
- **Dev-tool-specific** — purpose-built for AI coding workflows. Not a generic note-taking app.
- **Auto-capture** — memories are extracted automatically from your sessions. You don't write anything manually.

---

## Install

```bash
npm install -g mnemo-ai
```

Requires **Node.js 20+** and an **Anthropic API key** ([get one free](https://console.anthropic.com)).

## Setup

```bash
# 1. Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Add it to your shell profile so it persists:
echo 'export ANTHROPIC_API_KEY=sk-ant-...' >> ~/.zshrc
```

## Quick start

```bash
cd your-project

# 1. Set up mnemo + MCP for your AI tools
mnemo init

# 2. Start watching (run alongside your AI coding session)
mnemo watch

# 3. Later — ask mnemo what it remembers
mnemo recall "how did we handle auth?"
mnemo recall "why did we choose postgres?"

# 4. See everything captured
mnemo recall

# 5. Check your memory stats
mnemo status
```

---

## How it works

mnemo runs a background daemon that watches your AI coding session files. It captures memories on two triggers: **30 seconds of inactivity** (between pauses) and a **5-minute safety net** (during long continuous sessions). Extracted memories include:

| Type | What it captures |
|------|-----------------|
| `decision` | Architecture/implementation choices and why |
| `rejection` | Approaches tried and abandoned |
| `pattern` | Recurring conventions for this codebase |
| `reference` | Where important things live |
| `error` | Error patterns and their fixes |

Memories are stored locally in `~/.mnemo/memories.db` — your data never leaves your machine (free tier).

### Data flow

```
AI session files (.jsonl)
  → mnemo watches for changes (chokidar)
  → flushes on 30s inactivity OR every 5 minutes
  → extracts decisions, patterns, references (AI-powered)
  → stores in local SQLite with FTS5 + semantic embeddings
  → next session: MCP injects memories automatically
```

---

## Commands

```bash
mnemo init              # set up MCP integration for your AI tools
mnemo watch             # start session watcher daemon
mnemo recall            # show recent memories for this project
mnemo recall <query>    # semantic search + AI-synthesized answer
mnemo status            # memory stats for current project
mnemo forget <id>       # delete a specific memory
mnemo mcp               # start MCP server (used internally by AI tools)
mnemo prompt            # shell prompt indicator (for PS1 integration)
```

---

## Status Awareness

mnemo keeps you informed about its state — both in your terminal and inside your AI tools.

### Shell prompt indicator

Add this to your `~/.zshrc` or `~/.bashrc`:

```bash
export PS1='$(mnemo prompt)'$PS1
```

When the watcher is active, your prompt shows `[mnemo]`:

```
[mnemo] ~/my-project (main) $
```

### MCP status line

Every time your AI tool loads context, mnemo reports its state:

```
[mnemo] watching | 42 memories | branch: main | last: 2m ago
```

Your AI knows whether mnemo is active, how many memories exist, and when the last capture happened.

---

## MCP Integration

After `mnemo init`, your AI tools automatically load memories at session start via [MCP](https://modelcontextprotocol.io/). Your AI arrives knowing:

- Key architectural decisions
- What's been tried and failed
- Patterns and conventions
- Where things live

### MCP Tools

| Tool | Description |
|------|-------------|
| `mnemo_context` | Load project memories + status line at session start |
| `mnemo_save` | Save a new decision, pattern, or reference |

---

## Memory types

```
[DECISION]  ★8  Using Postgres over MySQL for JSONB support
            → Need flexible schema for user prefs without migrations

[REJECTION] ★7  Tried Prisma migrations for this schema, abandoned
            → Too rigid for our multi-tenant approach, switched to raw SQL

[PATTERN]   ★6  Always validate with Zod before hitting the DB layer
            → files: src/lib/validators.ts

[REFERENCE] ★5  Auth logic lives in /lib/auth.ts, not /api/auth
```

Importance scale: 1 (minor detail) → 10 (critical architecture decision)

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `MNEMO_EXTRACT_MODEL` | No | Model for extraction (default: `claude-sonnet-4-5`) |
| `MNEMO_RECALL_MODEL` | No | Model for recall synthesis (default: `claude-sonnet-4-5`) |
| `MNEMO_EMBED_MODEL` | No | Model for embeddings (default: `claude-haiku-4-5`) |

Typical session cost: **< $0.01**

---

## Project structure

```
src/
  index.ts              # CLI entry point
  types.ts              # shared type definitions
  commands/
    init.ts             # mnemo init — MCP setup
    watch.ts            # mnemo watch — session watcher
    recall.ts           # mnemo recall — memory search
    status.ts           # mnemo status — stats
    forget.ts           # mnemo forget — delete memory
  core/
    extractor.ts        # AI-powered memory extraction
    watcher.ts          # session file watcher daemon
    embeddings.ts       # semantic embeddings for search
    git.ts              # git context (branch, project name)
  db/
    store.ts            # SQLite + FTS5 storage layer
  mcp/
    server.ts           # MCP server for AI tool integration
  utils/
    apikey.ts           # API key validation
```

---

## Pricing

| Tier | Price | What you get |
|------|-------|-------------|
| Solo | **Free** | Unlimited local memory, MCP, all CLI commands, FTS5 + semantic search, git branch-aware scoping |
| Pro | $9/dev/mo | Cloud sync, team memory vault, memory REST API, priority extraction |
| Team | $29/5 devs/mo | Shared project vault, admin controls, GitHub/GitLab org integration |

---

## Built with

- **Node.js + TypeScript** — CLI and MCP server
- **SQLite + FTS5** — local storage, zero config, full-text search
- **Anthropic API** — memory extraction + recall synthesis
- **MCP SDK** — AI tool integration (works with any MCP-compatible tool)
- **chokidar** — real-time session file watching

---

## License

MIT

---

Made by [GE Labs LLC](https://gelabs.dev)
