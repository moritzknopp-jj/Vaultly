<p align="center">
  <img src="src/assets/logo.png" width="80" height="80" alt="Vaultly Logo" />
</p>

<h1 align="center">Vaultly</h1>

<p align="center">
  <strong>Chat with your Obsidian vault using local AI. Private, offline, yours.</strong>
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square" />
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-gold?style=flat-square&color=d4af37" />
</p>

---

## What is Vaultly?

Vaultly is a Windows desktop app that turns your [Obsidian](https://obsidian.md) vault into a private AI second brain. Your notes stay on your machine — the AI runs locally via Ollama, nothing is sent to the cloud.

## Features

- **Fully private** — AI runs on your machine via Ollama. Your notes never leave your device.
- **Semantic search** — Your vault is embedded and searched by meaning, not just keywords.
- **Streaming chat** — Ask questions, get instant context-aware answers from your own notes.
- **Note editor** — Browse, edit, and save `.md` files directly inside Vaultly.
- **Semantic graph** — Visualise which notes are conceptually related to each other.
- **Daily digest** — On startup, get a summary of what changed in your vault in the last 24 hours.
- **Linked mentions** — See backlinks and outlinks for any note.
- **Pin notes** — Pin important notes so their content is always injected into every chat.
- **Export chat** — Save any conversation as a `.md` file straight into your vault.
- **2-device limit** — Your account works on up to 2 machines.
- **7-day free trial** — No card needed.

## Download

Get the latest release from the [Releases](../../releases/latest) page.

Run `Vaultly-1.0.0-portable.exe` — no installation required, just double-click and go.

## Requirements

**[Ollama](https://ollama.ai)** must be installed and running. Pull the two required models:

```bash
ollama pull llama3
ollama pull nomic-embed-text
```

Ollama starts automatically after install — no manual steps needed after that.

## Getting Started

1. Download and run `Vaultly-1.0.0-portable.exe`
2. Create an account (7-day free trial, no card)
3. Click **Select Vault** and pick your Obsidian vault folder
4. Wait for indexing (30 seconds to a few minutes depending on vault size)
5. Start chatting

## Subscription

After the trial, Vaultly is **$8/month** paid in Bitcoin — no accounts, no subscriptions platform, just a one-time BTC transfer per month.

- A unique Bitcoin address is generated for your account
- Send the exact amount shown in the app
- Verification is automatic, access unlocks within seconds

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 28 |
| UI | React 18 + TypeScript + Vite 5 |
| Auth & database | Supabase |
| Local AI | Ollama |
| Embeddings | `nomic-embed-text` via Ollama |
| Vector search | In-memory cosine similarity |
| Payments | Blockonomics Bitcoin API |
| API key storage | Windows DPAPI (`safeStorage`) |

## Building from Source

```bash
npm install
npm run dev          # development (hot reload)
npm run build:win    # Windows portable .exe → dist-release/
```

Requires a `.env` file:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## License

MIT © 2026 Vaultly
