# ArvyaX AI-Assisted Journal System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete monorepo submission with a runnable Express API, Prisma/SQLite persistence, React frontend, LLM-powered journal analysis, caching, insights, and documentation.

**Architecture:** Use a root npm workspace with `apps/server` and `apps/client`. The server exposes the required REST APIs with layered separation and stores journal entries plus analyses in SQLite through Prisma. The client is a single-page React app that drives all required user flows and consumes the backend directly.

**Tech Stack:** Node.js, npm workspaces, Express, TypeScript, Prisma, SQLite, Zod, Vitest, React, Vite.

---

### Task 1: Workspace Skeleton

**Files:**
- Create: `package.json`
- Create: `apps/server/package.json`
- Create: `apps/client/package.json`
- Create: root and app `tsconfig` files

**Step 1: Write the failing test**
- N/A for package scaffolding.

**Step 2: Create workspace config**
- Add npm workspaces and delegated scripts for install, dev, build, Prisma, and tests.

**Step 3: Verify the skeleton**
- Run: `npm install`
- Expected: dependencies install without workspace errors.

### Task 2: Prisma Data Model

**Files:**
- Create: `apps/server/prisma/schema.prisma`
- Create: migration files under `apps/server/prisma/migrations`

**Step 1: Write the failing test**
- Add backend repository/integration tests that expect persisted journal entries and analyses.

**Step 2: Run test to verify it fails**
- Run: `npm --workspace @arvyax/server test`
- Expected: failures because schema and persistence code do not exist yet.

**Step 3: Write minimal implementation**
- Define `JournalEntry` and `JournalAnalysis` with timestamps, relation, JSON-string keywords storage, and unique `textHash`.

**Step 4: Run migration and tests**
- Run: `npm run db:migrate`
- Run: `npm --workspace @arvyax/server test`

### Task 3: Backend API

**Files:**
- Create: `apps/server/src/**`
- Test: `apps/server/src/tests/journalApi.test.ts`

**Step 1: Write the failing test**
- Cover:
  - `POST /api/journal`
  - `GET /api/journal/:userId`
  - `GET /api/journal/insights/:userId`
  - `POST /api/journal/analyze` missing env path
  - `POST /api/journal/analyze` cache-hit path

**Step 2: Run test to verify it fails**
- Run: `npm --workspace @arvyax/server test`

**Step 3: Write minimal implementation**
- Add app/server bootstrap, validation schemas, controllers, services, repositories, error middleware, and OpenAI-compatible client.

**Step 4: Run test to verify it passes**
- Run: `npm --workspace @arvyax/server test`

### Task 4: Frontend UI

**Files:**
- Create: `apps/client/src/**`

**Step 1: Write the failing test**
- Use build/typecheck as the verification gate for this lightweight frontend.

**Step 2: Implement**
- Add a single-page UI with user selection, create form, entries list, analyze action, analysis cards, and insights panel.

**Step 3: Verify**
- Run: `npm --workspace @arvyax/client build`

### Task 5: Documentation

**Files:**
- Create: `README.md`
- Create: `ARCHITECTURE.md`

**Step 1: Implement**
- Document overview, stack, setup, env vars, run commands, example API usage, tradeoffs, scaling, cost control, caching, and data protection.

**Step 2: Verify**
- Cross-check that every command in `README.md` exists in root scripts.

### Task 6: End-to-End Verification

**Files:**
- Modify as needed based on failures.

**Step 1: Install and generate**
- Run: `npm install`
- Run: `npm run db:migrate`

**Step 2: Build**
- Run: `npm run build`

**Step 3: Exercise APIs**
- Run the server locally and verify each required route with `curl`.

**Step 4: Fix failures**
- Repeat until install, migration, build, and route checks all succeed.
