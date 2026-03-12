# ArvyaX AI-Assisted Journal System

## Project Overview
This repository contains a full-stack submission for the ArvyaX AI-Assisted Journal System assignment. Users can:

- create journal entries after forest, ocean, or mountain sessions
- fetch previous entries by user
- analyze journal text with a real OpenAI-compatible LLM
- review aggregate insights computed from stored entries and stored analyses

The app is structured as a small npm-workspace monorepo and is ready to run locally without manual patching.

## Stack Choice
- Backend: Node.js, Express, TypeScript
- Frontend: React, TypeScript, Vite
- Database: SQLite with Prisma ORM
- LLM integration: OpenAI Node SDK against a configurable OpenAI-compatible base URL
- Tests: Vitest + Supertest backend integration tests

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
│       │   │   ├── 20260312153301_init
│       │   │   │   └── migration.sql
│       │   │   └── 20260312154709_init
│       │   │       └── migration.sql
│       │   ├── migration_lock.toml
│       │   └── schema.prisma
│       ├── src
│       │   ├── config
│       │   │   └── env.ts
│       │   ├── controllers
│       │   │   ├── baseController.ts
│       │   │   └── journalController.ts
│       │   ├── lib
│       │   │   └── prisma.ts
│       │   ├── middleware
│       │   │   └── errorHandler.ts
│       │   ├── repositories
│       │   │   └── journalRepository.ts
│       │   ├── routes
│       │   │   └── journalRoutes.ts
│       │   ├── scripts
│       │   │   ├── seed.ts
│       │   │   └── verifyEndpoints.ts
│       │   ├── services
│       │   │   ├── analysisService.ts
│       │   │   └── journalService.ts
│       │   ├── tests
│       │   │   ├── journalApi.test.ts
│       │   │   └── setup.ts
│       │   ├── types
│       │   │   └── journal.ts
│       │   ├── utils
│       │   │   ├── appError.ts
│       │   │   └── hash.ts
│       │   ├── validators
│       │   │   └── journalSchemas.ts
│       │   ├── app.ts
│       │   └── server.ts
│       ├── tsconfig.build.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── docs
│   └── plans
└── package.json
```

## Local Developer Experience
- npm workspaces only
- backend port: `4000`
- frontend port: `5173`
- root scripts delegate to workspace scripts

## Environment Variables
Copy the examples first:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
```

### Sample `apps/server/.env`
```bash
DATABASE_URL="file:./prisma/dev.db"
PORT=4000
OPENAI_API_KEY="sk-your-real-provider-key"
OPENAI_BASE_URL="https://api.openai.com/v1"
LLM_MODEL="gpt-4.1-mini"
```

### Sample `apps/client/.env`
```bash
VITE_API_BASE_URL="http://localhost:4000"
```

Notes:
- If LLM env vars are missing, `POST /api/journal/analyze` returns a real `500` error response. It never returns fake analysis.
- The app still runs without LLM env vars, so reviewers can inspect create/list/insights flows locally.

## Setup
```bash
npm install
npm run db:generate
npm run db:migrate
npm run seed
```

## Run Locally
Run both apps:

```bash
npm run dev
```

Run separately:

```bash
npm run dev:server
npm run dev:client
```

Open:
- frontend: `http://localhost:5173`
- backend: `http://localhost:4000`

## Available Commands
```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:studio
npm run seed
npm run verify:endpoints
npm test
npm run build
npm run dev
npm run dev:server
npm run dev:client
```

## API Contract

### `POST /api/journal`
- success: `201`
- invalid input: `400`

Request:
```json
{
  "userId": "123",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain."
}
```

Sample success response:
```json
{
  "id": "cmmnms8wb00004pbtficuryha",
  "userId": "123",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain.",
  "createdAt": "2026-03-12T15:36:53.003Z",
  "analysis": null
}
```

### `GET /api/journal/:userId`
- success: `200`

Sample success response:
```json
[
  {
    "id": "cmmnms8wb00004pbtficuryha",
    "userId": "123",
    "ambience": "forest",
    "text": "I felt calm today after listening to the rain.",
    "createdAt": "2026-03-12T15:36:53.003Z",
    "analysis": null
  }
]
```

### `POST /api/journal/analyze`
- success: `200`
- invalid input: `400`
- missing referenced entry: `404`
- missing LLM config or upstream analysis failure: `500`

Request:
```json
{
  "journalEntryId": "ENTRY_ID_HERE",
  "text": "I felt calm today after listening to the rain."
}
```

Sample success response:
```json
{
  "emotion": "calm",
  "keywords": ["rain", "nature", "peace"],
  "summary": "The entry reflects relaxation after a nature session."
}
```

Sample error response:
```json
{
  "error": {
    "code": "LLM_UNAVAILABLE",
    "message": "LLM configuration is missing. Set OPENAI_API_KEY, OPENAI_BASE_URL, and LLM_MODEL."
  }
}
```

### `GET /api/journal/insights/:userId`
- success: `200`

Sample success response:
```json
{
  "totalEntries": 3,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["rain", "nature", "focus"]
}
```

### Standard Error Shape
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed."
  }
}
```

## Validation Rules
- `userId`: required non-empty string
- `ambience`: required and normalized to one of `forest`, `ocean`, `mountain`
- `text`: required, trimmed, minimum `5` characters

## Analysis Persistence and Caching
- analysis results are stored in the database even for raw-text analysis requests
- a SHA-256 `textHash` is stored with every persisted analysis
- repeated text analysis checks persisted results before any upstream LLM call
- the analyze endpoint accepts raw text and also associates an analysis with a stored journal entry when `journalEntryId` is provided

## Seed Data
Populate demo entries for `demo-user` and `review-user`:

```bash
npm run seed
```

This seeds journal entries only. It does not fabricate LLM analyses.

## Sample curl Requests

Create entry:
```bash
curl -X POST http://localhost:4000/api/journal \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "ambience": "forest",
    "text": "I felt calm today after listening to the rain."
  }'
```

Get entries:
```bash
curl http://localhost:4000/api/journal/123
```

Analyze text:
```bash
curl -X POST http://localhost:4000/api/journal/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I felt calm today after listening to the rain."
  }'
```

Analyze a stored entry:
```bash
curl -X POST http://localhost:4000/api/journal/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "journalEntryId": "ENTRY_ID_HERE",
    "text": "I felt calm today after listening to the rain."
  }'
```

Get insights:
```bash
curl http://localhost:4000/api/journal/insights/123
```

## Verification
Automated backend tests cover each required endpoint:
- `POST /api/journal`
- `GET /api/journal/:userId`
- `POST /api/journal/analyze`
- `GET /api/journal/insights/:userId`

Submission verification checklist:
```bash
npm install
npm run db:generate
npm run db:migrate
npm run seed
npm run verify:endpoints
npm test
npm run build
```

Verified locally in this workspace:
- dependency install
- Prisma client generation
- migration application
- seed execution
- scripted HTTP endpoint verification
- automated backend tests
- backend build
- frontend build

## Screenshots Placeholder
Add screenshots here before external submission packaging if desired:

- Placeholder: main journal page at `http://localhost:5173`
- Placeholder: populated entries list with stored analyses
- Placeholder: insights panel after analyzing seeded entries

## Troubleshooting

### `POST /api/journal/analyze` returns `500`
This is expected if `OPENAI_API_KEY`, `OPENAI_BASE_URL`, or `LLM_MODEL` are missing or invalid.

### Prisma migration issues
Re-run:
```bash
npm run db:generate
npm run db:migrate
```

### Port already in use
- backend must run on `4000`
- frontend must run on `5173`
- stop the conflicting process or change your local environment before starting the app

### Seed command does not appear to change anything
The seed script resets demo users and re-inserts the same sample entries. Query `demo-user` from the UI or API to confirm the seeded data.

## Assumptions and Tradeoffs
- Authentication is out of scope, so `userId` is provided directly.
- SQLite is used for local portability and fast review; the scale path is documented in [ARCHITECTURE.md](/home/tariqul/Documents/GitHub/arvyax-ai-journal-system/ARCHITECTURE.md).
- The frontend stays intentionally small and focused on the assignment flows.
- The system never returns fake LLM output. If the model cannot be used, the API returns a real error instead.
