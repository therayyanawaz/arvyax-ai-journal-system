# ArvyaX AI-Assisted Journal System

A small full-stack journal app for immersive nature sessions. Users can create entries, review their history, analyze entries with a real AI provider, and inspect aggregated insights over time.

The project ships with two backend AI providers:

- `openaiApi`: standard backend API-key integration. This is the recommended production default.
- `codexChatgpt`: Browser-based ChatGPT sign-in using the official Codex app-server account flow. This is designed for trusted/local rich-client style usage, not a public multi-user SaaS default.

## Reviewer Quick Start

Use `openaiApi` as the default review path. It is the simplest backend-only setup and matches the intended assignment flow.

1. Copy `apps/server/.env.example` to `apps/server/.env`.
2. Keep `AI_PROVIDER="openaiApi"` and `CODEX_PROVIDER_ENABLED="false"`.
3. Set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `LLM_MODEL`.
4. Run:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run seed
npm run verify:endpoints
npm run test
npm run build
npm run dev
```

Notes:

- `npm run verify:endpoints` validates the required assignment routes and error contract without requiring a live LLM call for every step.
- To manually verify one real `200` analysis response, configure `openaiApi` or enable the optional local `codexChatgpt` flow and sign in with ChatGPT.
- `codexChatgpt` is implemented and working, but it is intentionally an advanced local/trusted mode, not the default reviewer path.

## Stack

- Backend: Node.js, Express, TypeScript
- Frontend: React, TypeScript, Vite
- Database: SQLite with Prisma ORM
- AI providers:
  - OpenAI-compatible API provider using `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LLM_MODEL`
  - Bundled official `@openai/codex` app-server adapter for ChatGPT browser login

## Project Overview

Core assignment APIs:

- `POST /api/journal`
- `GET /api/journal/:userId`
- `POST /api/journal/analyze`
- `GET /api/journal/insights/:userId`

Additional reviewer-friendly APIs:

- `GET /api/ai/provider`
- `POST /api/ai/provider`
- `POST /api/auth/codex/start`
- `GET /api/auth/codex/status/:loginId`
- `GET /api/auth/codex/account`
- `POST /api/auth/codex/logout`

Analysis results are persisted in SQLite and cached by normalized text hash so repeated analysis does not re-bill the provider.

## Exact Folder Structure

```text
.
├── AGENTS.md
├── ARCHITECTURE.md
├── README.md
├── apps
│   ├── client
│   │   ├── .env.example
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── styles.css
│   │   ├── tsconfig.json
│   │   ├── tsconfig.node.json
│   │   └── vite.config.ts
│   └── server
│       ├── .env.example
│       ├── package.json
│       ├── prisma
│       │   ├── migrations
│       │   └── schema.prisma
│       └── src
│           ├── ai
│           │   ├── codexAppServer
│           │   │   ├── client.ts
│           │   │   └── types.ts
│           │   ├── providers
│           │   │   ├── codexChatgptProvider.ts
│           │   │   └── openaiApiProvider.ts
│           │   ├── providerFactory.ts
│           │   └── types.ts
│           ├── controllers
│           ├── middleware
│           ├── repositories
│           ├── routes
│           ├── scripts
│           ├── services
│           ├── tests
│           ├── types
│           ├── utils
│           ├── validators
│           ├── app.ts
│           └── server.ts
├── package.json
├── package-lock.json
└── tsconfig.base.json
```

## Environment Variables

Backend sample:

```bash
# apps/server/.env
DATABASE_URL="file:./prisma/dev.db"
PORT=4000
CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

# Safe default for deployments
AI_PROVIDER="openaiApi"

# Enable only if you want the bundled Codex ChatGPT browser-login adapter
CODEX_PROVIDER_ENABLED="false"

OPENAI_API_KEY="sk-your-key"
OPENAI_BASE_URL="https://api.openai.com/v1"
LLM_MODEL="gpt-4.1-mini"
```

`CORS_ALLOWED_ORIGINS` is a comma-separated allowlist for browser origins. If you leave it empty, the backend only grants CORS access to localhost and `127.0.0.1` browser origins by default.

Frontend sample:

```bash
# apps/client/.env
VITE_API_BASE_URL="http://localhost:4000"
```

## Setup

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
npm run db:generate
npm run db:migrate
npm run seed
```

## Run Locally

Run backend and frontend together:

```bash
npm run dev
```

Or separately:

```bash
npm run dev:server
npm run dev:client
```

Frontend:

- `http://localhost:5173`

Backend:

- `http://localhost:4000`

## Screenshots Placeholder

Add screenshots here before submission if desired:

- journal form
- provider selector and ChatGPT sign-in panel
- analyzed entry with persisted insights

## Codex ChatGPT Login Mode

`codexChatgpt` uses the official Codex app-server account flow, not a website OAuth system you build yourself.

Flow:

1. The frontend calls `POST /api/auth/codex/start`.
2. The backend asks the bundled Codex app-server to begin `account/login/start` with `type: "chatgpt"`.
3. The backend returns `{ loginId, authUrl }`.
4. The frontend opens `authUrl` in the browser.
5. Codex handles the local callback and emits `account/login/completed` and `account/updated`.
6. The frontend polls `GET /api/auth/codex/status/:loginId` and refreshes `GET /api/auth/codex/account`.
7. The `codexChatgpt` provider can then be used for `POST /api/journal/analyze`.

Important:

- end users do not manually install Codex CLI globally for this repo
- the backend bundles the official `@openai/codex` package through `npm install`
- the frontend never sees tokens or auth files
- no token copy/paste flow exists in this app
- this is best suited to trusted/local deployments where the backend can own a local browser callback
- for a normal public multi-user SaaS deployment, use `openaiApi`

## OpenAI API Mode

`openaiApi` is the normal backend-managed provider:

- no browser login
- no local Codex session
- credentials stay on the backend
- easier to operate in server environments and public deployments

Set:

```bash
AI_PROVIDER="openaiApi"
OPENAI_API_KEY="..."
OPENAI_BASE_URL="https://api.openai.com/v1"
LLM_MODEL="gpt-4.1-mini"
```

## Provider Switching

The frontend selector talks to:

- `GET /api/ai/provider`
- `POST /api/ai/provider`

Behavior:

- a provider may be selectable but not yet ready
- `codexChatgpt` is selectable when the bundled adapter is available
- `codexChatgpt` becomes ready only after ChatGPT sign-in succeeds
- `openaiApi` becomes ready only when backend env vars are configured

## API Usage

### `POST /api/journal`

Request:

```bash
curl -X POST http://localhost:4000/api/journal \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "ambience": "forest",
    "text": "I felt calm today after listening to the rain."
  }'
```

Sample response:

```json
{
  "id": "clx...",
  "userId": "123",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain.",
  "createdAt": "2026-03-12T16:00:00.000Z",
  "analysis": null
}
```

### `GET /api/journal/:userId`

```bash
curl http://localhost:4000/api/journal/123
```

Sample response:

```json
[
  {
    "id": "clx...",
    "userId": "123",
    "ambience": "forest",
    "text": "I felt calm today after listening to the rain.",
    "createdAt": "2026-03-12T16:00:00.000Z",
    "analysis": null
  }
]
```

### `POST /api/journal/analyze`

Analyze raw text:

```bash
curl -X POST http://localhost:4000/api/journal/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I felt calm today after listening to the rain."
  }'
```

Analyze and associate with a stored entry:

```bash
curl -X POST http://localhost:4000/api/journal/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "journalEntryId": "ENTRY_ID_HERE",
    "text": "I felt calm today after listening to the rain."
  }'
```

Sample response:

```json
{
  "emotion": "calm",
  "keywords": ["rain", "focus", "nature"],
  "summary": "The entry reflects calm after a nature session."
}
```

### `GET /api/journal/insights/:userId`

```bash
curl http://localhost:4000/api/journal/insights/123
```

Sample response:

```json
{
  "totalEntries": 3,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["rain", "focus", "nature"]
}
```

### `GET /api/ai/provider`

```bash
curl http://localhost:4000/api/ai/provider
```

Sample response:

```json
{
  "activeProvider": "openaiApi",
  "providers": [
    {
      "name": "openaiApi",
      "label": "OpenAI API",
      "selected": true,
      "available": true,
      "ready": true,
      "reason": null
    },
    {
      "name": "codexChatgpt",
      "label": "Codex ChatGPT",
      "selected": false,
      "available": false,
      "ready": false,
      "reason": "Codex ChatGPT provider is disabled. Set CODEX_PROVIDER_ENABLED=true to enable it."
    }
  ]
}
```

### `POST /api/auth/codex/start`

```bash
curl -X POST http://localhost:4000/api/auth/codex/start
```

Sample response:

```json
{
  "loginId": "f90c2f1d-...",
  "authUrl": "https://chatgpt.com/..."
}
```

### `GET /api/auth/codex/status/:loginId`

```bash
curl http://localhost:4000/api/auth/codex/status/f90c2f1d-...
```

Sample response:

```json
{
  "loginId": "f90c2f1d-...",
  "status": "pending",
  "error": null,
  "authUrl": "https://chatgpt.com/..."
}
```

### `GET /api/auth/codex/account`

```bash
curl http://localhost:4000/api/auth/codex/account
```

Sample response:

```json
{
  "enabled": true,
  "available": true,
  "ready": true,
  "authStatus": "signed-in",
  "authMode": "chatgpt",
  "email": "user@example.com",
  "planType": "plus",
  "requiresOpenaiAuth": true,
  "rateLimits": null,
  "availabilityReason": null,
  "activeLoginId": null
}
```

### Standard Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message"
  }
}
```

## Validation Rules

- `userId`: required non-empty string
- `ambience`: required and must be one of `forest`, `ocean`, `mountain`
- `text`: required, trimmed, minimum 5 characters

## Verification Commands

```bash
npm install
npm run db:generate
npm run db:migrate
npm run seed
npm run verify:endpoints
npm test
npm run build
```

## Troubleshooting

### Codex provider is disabled in the UI

- set `CODEX_PROVIDER_ENABLED="true"` in `apps/server/.env`
- restart the backend
- run `npm install` if the bundled `@openai/codex` package is missing

### ChatGPT sign-in window opens but login never completes

- verify the backend is running locally on `http://localhost:4000`
- retry the login from the auth panel
- check backend logs for Codex app-server startup or callback errors
- remember this flow expects trusted/local callback semantics

### Codex provider stays unavailable

- confirm `npm install` completed successfully
- confirm your environment supports the official `@openai/codex` package
- call `GET /api/auth/codex/account` and inspect `availabilityReason`

### OpenAI API mode is selected but analysis fails

- confirm `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `LLM_MODEL` are set on the backend
- verify the selected provider through `GET /api/ai/provider`

### Invalid JSON returned from an AI provider

- the backend validates and normalizes the final payload
- retry once
- if the issue persists, inspect backend logs and switch providers if needed

## Assumptions and Tradeoffs

- the app intentionally has no end-user auth system because the assignment did not require it
- journal ownership is keyed by `userId` supplied by the caller
- Codex ChatGPT login is modeled as a backend-owned local/trusted session, not a public multi-user account system
- SQLite is correct for local development and assignment review; production scale would move to PostgreSQL
- repeated analysis is cached by text hash to avoid duplicate provider cost

## Pre-production Checklist

- set `AI_PROVIDER="openaiApi"`
- configure `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `LLM_MODEL`
- verify `CODEX_PROVIDER_ENABLED="false"` unless you explicitly want the local/trusted Codex flow
- verify no local auth artifacts or copied secrets are committed
- run `npm run verify:endpoints`
- run `npm test`
- run `npm run build`

## Limitations

- `codexChatgpt` depends on local browser-login semantics and is therefore not the default recommendation for public multi-user SaaS hosting
- the app does not implement user authentication or authorization
- rate-limit metadata from Codex is best-effort optional UI metadata, not a billing system
