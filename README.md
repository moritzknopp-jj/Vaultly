# Vaultly 🔐

A privacy-first desktop app to chat with your Obsidian vault using local AI (Ollama).

## Features

- 🤖 Local AI via Ollama (llama3 + nomic-embed-text) — your notes never leave your machine
- 🔐 Supabase authentication with 30-day free trial
- ₿ Bitcoin payment via Blockonomics ($8/month)
- 📁 Recursive Obsidian vault indexing with vector search
- 🖥️ Frameless Electron desktop app (Windows, macOS, Linux)

## Prerequisites

1. **Node.js** 18+ and npm
2. **Ollama** — install from [ollama.ai](https://ollama.ai), then pull models:
   ```bash
   ollama pull llama3
   ollama pull nomic-embed-text
   ```
3. **Supabase** project with the schema from `supabase/schema.sql`

## Setup

```bash
# Clone and install
git clone https://github.com/moritzknopp-jj/Vaultly
cd Vaultly
npm install

# Copy env file and fill in your values
cp .env.example .env
# Edit .env with your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Run in dev mode
npm run dev
```

## Environment Variables

Create a `.env` file (see `.env.example`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Security**: The `BLOCKONOMICS_API_KEY` is only used server-side in Supabase Edge Functions via `Deno.env.get('BLOCKONOMICS_API_KEY')` — it is never exposed to the frontend.

## Supabase Edge Functions

Set these secrets in your Supabase project:
```bash
supabase secrets set BLOCKONOMICS_API_KEY=your-key
```

Deploy edge functions:
```bash
supabase functions deploy generate-btc-address
supabase functions deploy verify-payment
supabase functions deploy check-subscription
```

## Database

Run `supabase/schema.sql` in your Supabase SQL editor to create the required tables.

## Build

```bash
npm run build
```

Packaged app will be in the `release/` directory.

## Architecture

```
src/
├── components/
│   ├── Auth/          # Login & Register screens
│   ├── Chat/          # Main chat UI + message bubbles
│   ├── Paywall/       # Bitcoin payment screen
│   └── Settings/      # Vault picker overlay
├── lib/
│   ├── supabase.ts    # Supabase client
│   ├── ollama.ts      # Ollama API (embed + stream chat)
│   ├── vectorSearch.ts # In-memory vector store
│   └── deviceId.ts    # Device fingerprinting
electron/
├── main.ts            # Electron main process
└── preload.ts         # Context bridge API
supabase/
├── functions/         # Edge functions (BTC payment, subscription)
└── schema.sql         # Database schema
```