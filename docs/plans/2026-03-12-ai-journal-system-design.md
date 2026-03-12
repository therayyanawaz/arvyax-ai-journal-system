# ArvyaX AI-Assisted Journal System Design

## Goal
Build a runnable monorepo with a Node.js/Express/TypeScript API, Prisma/SQLite persistence, a React/Vite frontend, and a real OpenAI-compatible journal analysis flow that persists results and powers user insights.

## Recommended Approach
Use a modular monorepo with `apps/server` and `apps/client` plus a shared Prisma schema under the server app. The backend owns validation, persistence, analysis orchestration, caching by text hash, and insights aggregation. The frontend stays intentionally thin: a single page that drives the required flows against the API.

This is the right tradeoff for the assignment because it keeps the system small and runnable locally while still showing production-oriented structure: route/controller/service separation, typed validation, persisted analysis results, and repeat-analysis cost control.

## Alternatives Considered
1. Single Express app serving static HTML.
   Tradeoff: fastest path, but weaker signal on frontend structure and TypeScript React expectations.

2. Next.js full-stack app with API routes.
   Tradeoff: viable, but it diverges from the preferred Express backend stack and adds framework complexity that does not help the assignment.

3. Split service and client as independent repos.
   Tradeoff: clean isolation, but unnecessary overhead for a local submission.

## Architecture
### Backend
- Express app with `routes -> controllers -> services -> repositories`.
- Prisma models:
  - `JournalEntry`
  - `JournalAnalysis`
- Zod validates request bodies and route params.
- Analysis service calls an OpenAI-compatible chat completion endpoint using `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `LLM_MODEL`.
- A SHA-256 text hash is computed for each analyzed text. Existing analyses are reused before any LLM call.
- Insights are computed from journal entries plus stored analyses. No fake fallback data exists.

### Frontend
- Vite + React + TypeScript single page.
- Sections:
  - user context selector
  - create entry form
  - entries list
  - analysis display
  - insights panel
- Fetch-based API client with loading and error states.

## Data Flow
1. User enters `userId`, ambience, and journal text.
2. Frontend posts to `POST /api/journal`.
3. Server validates input and persists the entry.
4. Frontend refreshes entries and insights.
5. User clicks Analyze on an entry.
6. Frontend posts entry id and text to `POST /api/journal/analyze`.
7. Server checks hash cache, reuses a stored result if possible, otherwise calls the LLM, validates strict JSON, persists the analysis, and returns it.
8. Insights endpoint aggregates totals, top emotion, ambience frequency, and recent deduplicated keywords.

## Error Handling
- Validation failures return `400`.
- Missing LLM env vars return `503`.
- Invalid upstream LLM responses return `502`.
- Unknown server failures return `500` with a consistent JSON envelope.

## Testing Strategy
- Backend integration tests cover:
  - creating entries
  - listing entries newest first
  - insight calculations
  - analyze endpoint cache hit and config failure paths
- Frontend relies on TypeScript build verification for this submission, plus manual API exercise against the running server.

## Assumptions
- Local SQLite is sufficient for the submission.
- User identity is provided explicitly as `userId`; no auth system is required in scope.
- Duplicate analysis reuse should be global by text content, not limited per user, because the assignment explicitly asks to reduce repeated analysis cost.
