# AI Writing Assistant

> A lightweight, locally-running AI-assisted novel writing tool

**AI Writing Assistant** is a localized writing tool designed for long-form novel authors. It integrates chapter splitting, knowledge extraction, knowledge base management, knowledge graph visualization, and AI-assisted writing into a seamless workflow — helping authors manage complex worldbuilding, character relationships, and plot threads efficiently.

---

## Core Features

| Module | Description |
|--------|-------------|
| **📑 Chapter Management** | Upload `.txt` novel files, auto-split by regex patterns, anomaly detection |
| **🧠 Knowledge Extraction** | AI extracts characters, techniques, locations, worldbuilding, weapons, alchemy, and plot elements from chapters |
| **📚 Knowledge Base** | Browse, search, edit entries with version history, soft delete, and trash recovery |
| **🕸️ Knowledge Graph** | Cytoscape.js-powered visualization of relationship networks between knowledge nodes |
| **✍️ Writing Window** | TipTap rich text editor with outline/body dual-mode, AI generate/continue/polish/expand/shorten/rewrite/foreshadowing check |
| **📝 Setting Conception** | Isolated setting editor with knowledge base references and migration capability |
| **💬 Brainstorming** | AI chat-based brainstorming with multi-turn discussion and conclusion extraction |
| **⚙️ System Config** | Multi-model support (Claude / OpenAI / Ollama), function-to-model mapping, context budget management |

---

## Tech Stack Overview

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + Zustand
- **Editor**: TipTap (rich text)
- **Graph**: Cytoscape.js (relationship visualization)
- **Backend**: Node.js + Express + TypeScript
- **AI**: Claude Agent SDK (Claude / OpenAI / Ollama multi-provider)
- **Storage**: SQLite (search index) + JSON files (version management)
- **Scripts**: Python 3.10+ (chapter splitting)

---

## Requirements

| Dependency | Minimum Version | Notes |
|------------|----------------|-------|
| **Node.js** | >= 20.0.0 | JavaScript runtime |
| **pnpm** | >= 9.0.0 | Package manager (monorepo workspaces) |
| **Python** | >= 3.10 | Chapter splitting scripts (stdlib only) |
| **OS** | Windows / macOS / Linux | Cross-platform |

> 💡 **Python path**: On Windows, ensure `python` is on PATH; on macOS/Linux, `python3` is used.

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repo-url>
cd writing-assistant
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure API Keys

Copy the environment template and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and fill in at least one AI provider key:

```env
ANTHROPIC_API_KEY=sk-ant-xxx   # Claude API
OPENAI_API_KEY=sk-xxx           # OpenAI API (optional)
OLLAMA_API_KEY=                 # Ollama local model (optional)
```

> ⚠️ **The `.env` file is gitignored** and will never be committed.

### 4. Start

```bash
pnpm dev
```

- Backend runs at `http://localhost:3000`
- Frontend runs at `http://localhost:5173`
- Open `http://localhost:5173` in your browser

### 5. Production Build (Optional)

```bash
pnpm build
```

Build outputs: `server/dist/` and `client/dist/`.

---

## Usage Guide

### Typical Workflow

```
Upload Novel → Split Chapters → AI Extract Knowledge → Browse/Edit KB → AI-Assisted Writing → Done
```

1. **Upload Novel**: Drag-and-drop or click to upload a `.txt` file on the Chapters page
2. **Split**: The system auto-detects chapter headers; you can adjust regex rules manually
3. **Extract Knowledge**: Configure an extraction task on the Knowledge page — AI processes chapters sequentially
4. **Manage Knowledge**: Search, edit, and version-track entries on the Knowledge Base page
5. **Visualize**: Explore knowledge relationships on the Graph page
6. **Write**: Use the Writing Window — write outlines and let AI generate body text with knowledge-backed context
7. **Brainstorm**: Discuss plot directions with AI on the Brainstorm page

---

## File Storage

All user data lives in the **`workspace/`** directory at the project root — fully local:

```
workspace/
├── originals/          ← Your uploaded .txt files
├── chapters/           ← Split chapter files
├── knowledge/          ← Knowledge base (one JSON file per entry)
│   ├── characters/     ←   Characters
│   ├── techniques/     ←   Techniques
│   ├── locations/      ←   Locations
│   ├── worldbuilding/  ←   Worldbuilding
│   ├── weapons/        ←   Weapons
│   ├── alchemy/        ←   Alchemy
│   ├── plot/           ←   Plot
│   ├── _index.db       ←   SQLite search index
│   ├── _skills/        ←   Custom extraction skills
│   └── _trash/         ←   Soft-deleted entries
├── settings/           ← Setting conception files (.md)
├── drafts/             ← Writing drafts
└── logs/               ← Application logs (daily rotation, 30-day retention)
```

> 🔒 **All data stays on your machine.** Nothing is uploaded to any cloud server.

---

## API Key Security

Multiple layers of protection for your API keys:

| Measure | Description |
|---------|-------------|
| **Env-var storage** | Keys live in `.env`, loaded into memory only — never written to databases or JSON files |
| **Log sanitization** | The logging system auto-detects and redacts 5+ API key formats (Anthropic, OpenAI, etc.) from log output |
| **Frontend masking** | The config page only shows "configured/unconfigured" status and `sk-a***xxxx` masks — never the full key |
| **Git excluded** | `.env` is in `.gitignore` — keys never land in version control |
| **Local runtime** | The entire app runs on your machine; keys are only used for direct API calls to AI providers |

---

## Data Security

- **Fully Local**: All files, databases, and logs reside in the local `workspace/` directory
- **Sandbox Isolation**: All file operations are confined to `workspace/` — path traversal attacks are blocked and logged
- **System File Protection**: `.workspace.lock`, `_meta.json` and other system files cannot be modified via regular API calls
- **XSS Prevention**: User input is sanitized — `<script>` tags and inline event handlers are stripped
- **Rate Limiting**: Global 120/min, AI operations 10/min, uploads 5/min
- **Upload Restrictions**: Only `.txt` files allowed (chapter upload), 50MB max

---

## FAQ

### Q: Port already in use?

Change `PORT=3000` in `.env` to another port, and update the proxy target in `client/vite.config.ts`.

### Q: Python splitting fails?

Ensure `python` (Windows) or `python3` (macOS/Linux) is on your PATH with version >= 3.10. The splitter uses only stdlib — no extra packages needed.

### Q: How to switch AI models?

On the System Config page you can:
- Add custom model presets
- Assign different models to different functions (extraction/writing/polishing)
- Test model connectivity

### Q: How to back up data?

Copy the entire `workspace/` folder to your backup location. You can also use the "Export" feature on the Knowledge Base page to generate a ZIP archive.

### Q: Can deleted entries be recovered?

The knowledge base uses soft delete — deleted entries go to the trash (`workspace/knowledge/_trash/`) and can be restored from the Knowledge Base management page.

---

## Version

- Project Version: v0.1.0
- Docs Updated: 2026-06-07
