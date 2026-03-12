# Architecture

## Current Design
The submission is a modular monorepo with:
- `apps/server`: Express API with route, controller, service, and repository layers
- `apps/client`: React single-page frontend
- Prisma + SQLite for local persistence

### Core Data Model
- `JournalEntry`
  - stores `userId`, `ambience`, `text`, and `createdAt`
- `JournalAnalysis`
  - stores optional `journalEntryId`, `emotion`, `keywordsJson`, `summary`, `textHash`, and `createdAt`

### Request Flow
1. The frontend creates a journal entry through `POST /api/journal`.
2. The server validates input with Zod and writes the entry with Prisma.
3. The frontend lists entries through `GET /api/journal/:userId`.
4. When analysis is requested, the server:
   - checks whether the entry already has an analysis
   - checks for a cached analysis by `textHash`
   - only calls the upstream LLM if neither exists
   - validates the LLM response as strict JSON
   - stores the analysis for future insight queries or future raw-text cache hits
5. Insights are computed from stored entries and stored analyses through `GET /api/journal/insights/:userId`.

### Current Operational Guarantees
- Handled failures use one JSON error shape:
  - `400` for invalid input
  - `404` for a missing referenced entry
  - `500` for unexpected server failures and LLM-unavailable cases
- Validation is centralized:
  - `userId` must be non-empty
  - `ambience` must be `forest`, `ocean`, or `mountain`
  - `text` is trimmed and must be at least 5 characters
- Raw-text analysis results are persisted even before they are attached to a journal entry.
- Cached analyses are linked to stored journal entries later when `journalEntryId` is supplied.
- A scripted endpoint verifier exercises all required endpoints over real HTTP for local review.

## 1. How Would This Scale to 100k Users?
For 100k users, I would keep the same logical boundaries and change the infrastructure around them:

- Move from SQLite to PostgreSQL.
- Add connection pooling and read indexes for:
  - `JournalEntry(userId, createdAt DESC)`
  - `JournalAnalysis(journalEntryId)`
  - `JournalAnalysis(textHash)`
- Split synchronous write paths from heavier analysis work.
  - `POST /api/journal` stays fast and only writes the entry.
  - analysis can move to a queue-backed worker for async processing at higher volume.
- Containerize the server and run multiple stateless API replicas behind a load balancer.
- Add Redis for hot insight caching and rate limiting.
- Introduce background materialization for expensive aggregates if insight queries grow beyond simple per-user scans.
- Add observability:
  - request latency
  - error rate
  - LLM usage and failure rate
  - queue lag if async analysis is added

The current code is intentionally small, but the separation between transport, business logic, and persistence is already in place, so moving from local SQLite to horizontally scaled API instances is straightforward.

## 2. How Would LLM Cost Be Reduced?
I would reduce cost in layers:

- Reuse prior analyses by hashing normalized journal text before any LLM call.
- Persist analyses to entries so insight generation never needs to re-call the model.
- Use a smaller model for first-pass extraction because this task only needs structured emotion, keywords, and summary output.
- Add heuristics to skip re-analysis when an entry already has an analysis and the text has not changed.
- Batch or queue analysis so retries and backoff are controlled centrally.
- Add per-user or per-IP rate limiting on the analyze endpoint.
- Cache failure states briefly to avoid hammering the provider during outages.

If usage increased substantially, I would also consider offline reprocessing jobs and prompt compression to shrink token usage.

## 3. How Would Repeated Analysis Be Cached?
The current implementation already does this with persisted storage:

- Normalize and hash the input text with SHA-256.
- Look for an existing `JournalAnalysis` row with the same `textHash`.
- If a match exists:
  - return that result immediately
  - copy the analysis onto the requested journal entry when `journalEntryId` is provided
- Only call the LLM when the hash is not already known

For larger scale, I would add a dedicated cache table or Redis layer keyed by `textHash`, with the database remaining the source of truth.

## 4. How Would Sensitive Journal Data Be Protected?
Sensitive journaling data needs stronger controls than this local assignment setup. In production I would add:

- Authentication and authorization so users can only access their own entries.
- Encryption at rest for the primary database and encrypted backups.
- TLS in transit for all client, server, and provider traffic.
- Secrets stored in a secret manager rather than plaintext env files.
- Audit logging for admin access and support tooling.
- Redaction and structured logging so raw journal text is never dumped into request logs.
- Data retention controls and hard-delete workflows for privacy requests.
- Optional field-level encryption for journal text if the threat model requires it.
- Strict vendor review and data processing controls for any external LLM provider.

The current implementation keeps sensitive data local in SQLite and avoids fake processing, but it does not include authentication because that is outside the assignment scope.
