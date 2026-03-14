# Architecture

## Current System

The repo is a small monorepo with:

- `apps/server`: Express + TypeScript API
- `apps/client`: React + TypeScript + Vite SPA
- Prisma + SQLite persistence
- a shared AI provider abstraction

Backend layering stays simple and explicit:

- routes
- controllers
- services
- repositories

## Data Model

### `JournalEntry`

- `id`
- `userId`
- `ambience`
- `text`
- `createdAt`

### `JournalAnalysis`

- `id`
- `journalEntryId` nullable for raw-text cache entries
- `emotion`
- `keywordsJson`
- `summary`
- `textHash`
- `createdAt`

## Provider Abstraction

The rest of the backend depends on a shared provider interface and runtime selection layer:

- `apps/server/src/ai/types.ts`
- `apps/server/src/ai/providerFactory.ts`
- `apps/server/src/ai/providers/openaiApiProvider.ts`
- `apps/server/src/ai/providers/codexChatgptProvider.ts`

### `openaiApi`

- standard backend API-key flow
- uses `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LLM_MODEL`
- recommended production runtime path

### `codexChatgpt`

- uses the official Codex app-server account flow
- starts ChatGPT-managed browser login with `account/login/start`
- receives `account/login/completed` and `account/updated`
- keeps auth artifacts on the backend side only
- is best suited to trusted/local rich-client style deployments

## Codex ChatGPT Browser Login

This app models a browser-based trusted-session UX:

1. frontend calls `POST /api/auth/codex/start`
2. backend sends `account/login/start` with `{ "type": "chatgpt" }`
3. Codex app-server returns `{ loginId, authUrl }`
4. frontend opens `authUrl`
5. Codex app-server hosts the local callback and completes ChatGPT-managed auth
6. backend tracks `account/login/completed`
7. frontend polls `GET /api/auth/codex/status/:loginId`
8. frontend refreshes `GET /api/auth/codex/account`
9. journal analysis can use the authenticated Codex-backed session

Implementation files:

- `apps/server/src/ai/codexAppServer/client.ts`
- `apps/server/src/ai/codexAppServer/types.ts`

## Why Codex ChatGPT Login Is Not The Default SaaS Production Path

The Codex ChatGPT browser-login mode intentionally uses local callback semantics and a backend-owned app-server session. That is useful for trusted/local integrations, but it is a weak fit for a normal public multi-user SaaS deployment because:

- the backend owns one local Codex runtime session rather than a normal per-user web auth system
- browser callback semantics are easiest when the backend and user are in a trusted/local environment
- scaling a workstation-style auth/session model across containers and stateless instances is operationally awkward
- deployment environments generally want explicit backend-managed credentials, not app-local interactive login state

That is why `openaiApi` remains the recommended production runtime path.

## Why Provider Swapping Is Safe

The journal service does not know whether analysis comes from Codex or OpenAI.

It only asks the active provider runtime for:

- current provider
- provider health
- `analyzeJournal(text)`

That keeps:

- auth logic inside the Codex adapter
- API-key logic inside the OpenAI adapter
- journal storage and insight computation independent from provider choice

## Request Flow

### Create entry

1. frontend calls `POST /api/journal`
2. server validates input with Zod
3. repository writes the entry to SQLite
4. created entry is returned with `201`

### Analyze entry

1. frontend calls `POST /api/journal/analyze`
2. server validates input
3. service checks:
   - existing analysis on the requested entry
   - cached analysis by normalized `textHash`
4. if cached:
   - return cached result immediately
   - attach cached result to the entry when `journalEntryId` is present
5. if not cached:
   - call the currently selected AI provider
   - validate strict JSON output
   - persist the result
6. return `emotion`, `keywords`, `summary`

### Insights

`GET /api/journal/insights/:userId` computes:

- `totalEntries`
- `topEmotion`
- `mostUsedAmbience`
- `recentKeywords`

It reuses stored analyses and never re-calls the AI provider.

## API Contract

Success:

- `POST /api/journal` -> `201`
- `GET` endpoints -> `200`
- `POST /api/journal/analyze` -> `200`

Failure:

- `400` invalid input
- `404` missing referenced entry or login id
- `500` provider/runtime/server failures

Error body:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable message"
  }
}
```

## 1. How Would This Scale To 100k Users?

The current code is intentionally small, but the next production step is straightforward:

- move from SQLite to PostgreSQL
- add indexes on:
  - `JournalEntry(userId, createdAt desc)`
  - `JournalAnalysis(journalEntryId)`
  - `JournalAnalysis(textHash)`
- make `POST /api/journal` synchronous and cheap
- move analysis execution to a queue-backed worker pool
- run multiple stateless API replicas behind a load balancer
- store hot per-user insights and rate-limit counters in Redis
- add observability for latency, queue lag, provider failure rate, and cost

For the Codex ChatGPT mode specifically, I would not scale it as the primary public provider. I would keep that flow for local/trusted operator environments and use `openaiApi` or another server-managed provider for scalable multi-instance deployments.

## 2. How Would LLM Cost Be Reduced?

Current implementation already reduces cost by:

- hashing normalized text before any provider call
- reusing cached raw-text analyses
- storing analyses on entries
- computing insights from stored rows only

Further cost controls:

- async queueing with centralized retries
- per-user rate limiting
- smaller structured-output models for extraction tasks
- batch reprocessing jobs outside the request path
- prompt compression and schema-first extraction

## 3. How Would Repeated Analysis Be Cached?

Current flow:

1. normalize text
2. compute SHA-256 `textHash`
3. check `JournalAnalysis` for the same hash
4. if found, return cached analysis without re-running Codex or OpenAI
5. if `journalEntryId` is present, attach the cached result to that entry

This means repeated analysis requests reuse persisted results across:

- raw text analysis
- stored journal entries
- insight queries

For larger scale, Redis can sit in front of the database, but the database remains the source of truth.

## 4. How Would Sensitive Journal Data Be Protected?

For a real production system:

- add authentication and authorization so callers can access only their own journals
- encrypt the primary database and backups
- enforce TLS everywhere
- keep secrets in a secret manager, not checked-in env files
- redact raw journal text from logs and traces
- add audit logging for support/admin access
- support deletion and retention controls
- use strict vendor review for external AI providers
- consider field-level encryption for journal text if the threat model requires it

For this assignment:

- secrets remain backend-only
- the frontend never receives provider credentials or auth artifacts
- Codex auth files are not stored in the repo
- cached analyses are persisted locally in SQLite

## Pre-production Checklist

- set `AI_PROVIDER="openaiApi"`
- set `CODEX_PROVIDER_ENABLED="false"` unless you explicitly want the local/trusted Codex flow
- configure `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `LLM_MODEL`
- verify no local auth artifacts or copied secrets are committed
- run `npm run verify:endpoints`
- run `npm test`
- run `npm run build`
