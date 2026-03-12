# AGENTS.md

## Project Structure
- `apps/server`: Express + TypeScript backend, Prisma schema, tests, and seed script
- `apps/client`: React + TypeScript + Vite frontend
- `docs/plans`: implementation and design notes
- `README.md`: setup and reviewer guide
- `ARCHITECTURE.md`: scale, cost, caching, and security notes

## Commands To Run
- `npm install`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run seed`
- `npm test`
- `npm run build`
- `npm run dev`
- `npm run dev:server`
- `npm run dev:client`

## Coding Conventions
- Keep the backend layered: routes -> controllers -> services -> repositories
- Validate all request input with Zod before business logic
- Use Prisma through repository classes, not directly in controllers
- Preserve strict TypeScript settings and keep imports working in ESM mode
- Keep UI simple and functional; do not add unnecessary abstractions
- Update docs when scripts, env vars, or behavior change

## Priorities
`correctness > simplicity > polish`

## LLM Rule
Never return fake, hardcoded, or placeholder LLM analysis output. If the model is unavailable or configuration is missing, return a real error response instead.
