<p align="center">
  <img src="src/assets/logo.png" width="80" height="80" alt="Vaultly Logo" />
</p>

<h1 align="center">Vaultly</h1>

<p align="center">
  <strong>Chat with your Obsidian vault using local AI. Private, offline, fast.</strong>
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-gold?style=flat-square&color=d4af37" />
</p>

---

## What is Vaultly?

Vaultly is a desktop app that connects your [Obsidian](https://obsidian.md) vault to a local AI assistant. Ask questions about your notes, get context-aware answers — all without sending your data to the cloud.

## Features

- 🔒 **Fully local** — AI runs on your machine via Ollama, nothing leaves your device
- 🧠 **Semantic search** — Embeds your notes and finds the most relevant context
- 💬 **Streaming chat** — Real-time response streaming with llama3
- 📦 **Obsidian-native** — Reads all your `.md` files recursively
- ₿ **Bitcoin payments** — $8/month subscription paid via Bitcoin (Blockonomics)
- 🔑 **2-device limit** — Secure per-device authentication
- 🆓 **30-day free trial** — No credit card needed

## How to Install

1. Download the latest installer from [Releases](../../releases/latest)
2. Run `Vaultly-Setup-1.0.0.exe`
3. Launch Vaultly and create an account

## Setting Up Ollama

Vaultly requires [Ollama](https://ollama.ai) for local AI.

1. Download and install Ollama from [ollama.ai](https://ollama.ai)
2. Open a terminal and run:

```bash
ollama pull llama3
ollama pull nomic-embed-text
```

3. Make sure Ollama is running (it starts automatically after install)

## How It Works

1. **Sign up** — 30-day free trial, no card needed
2. **Select vault** — Open Settings → Select your Obsidian vault folder
3. **Wait for indexing** — Vaultly embeds all your notes (takes 1–5 min)
4. **Chat** — Ask anything about your notes

## Screenshot

> _Screenshot coming soon_

## Subscription

After the 30-day trial, Vaultly costs **$8/month** paid in Bitcoin.

- A unique Bitcoin address is generated for your account
- Send the exact BTC amount shown in the app
- Payment is verified automatically, access unlocks instantly

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop app | Electron 28 + React 18 + TypeScript |
| UI build | Vite 5 |
| Auth + DB | Supabase |
| Local AI | Ollama (llama3) |
| Embeddings | nomic-embed-text via Ollama |
| Vector search | In-memory cosine similarity |
| Payments | Blockonomics Bitcoin API |

## Building from Source

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build (requires Electron environment)
npm run build:win    # Windows installer
npm run build:linux  # Linux AppImage
```

## Environment Variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## License

MIT © 2024 Vaultly
