# Technical & Infrastructure Overview

This document explains the technical setup of `nodeCore` in simple terms.

## What this project runs on

- Runtime: Node.js + TypeScript
- API framework: Fastify
- Database: PostgreSQL
- ORM: Prisma
- Realtime events: WebSocket (`/ws/events`, `/ws/business-events`)
- Validation: Zod
- Logging: Pino (structured logs)
- Package manager: pnpm

## Why these choices

- Node.js + TypeScript: fast development and safer code with types.
- Fastify: lightweight and high-performance API framework.
- PostgreSQL: reliable relational database with good support for business data.
- Prisma: clear schema, typed DB access, and migration support.
- WebSocket: pushes domain events to connected clients in real time.
- Zod: strict request validation at API boundaries.
- Pino: machine-readable logs for debugging and operations.

## Project structure (core-api)

`apps/core-api/src` uses strict layers:

- `domain/`: pure business rules (no framework/DB code)
- `application/`: use cases and orchestration
- `infrastructure/`: Prisma repos, pricing runner, adapters
- `interfaces/`: HTTP routes, auth plugin, WebSocket gateway

Dependency rule: outer layers depend on inner layers, not the opposite.

## Database and migrations

- Prisma schema is the source of truth: `apps/core-api/prisma/schema.prisma`
- Migrations are stored in: `apps/core-api/prisma/migrations/`
- `DATABASE_URL` must be set in `apps/core-api/.env`

Typical commands (from `apps/core-api`):

- `pnpm prisma generate`
- `pnpm prisma migrate dev --name <migration-name>`
- `pnpm prisma migrate deploy`

## Runtime integrations

- Pricing is executed by Python programs through stdin/stdout JSON contracts.
- Product versions point to pricing program versions (`fileRef`).
- Pricing runs are persisted for auditability (request/response and metadata).
- Event streaming:
  - `/ws/events` for full event feed
  - `/ws/business-events` for curated business event feed with subscribe filters (`eventTypes`, `entityTypes`, `entityIds`, `sinceOccurredAt`)

## Demo startup (frontend + backend)

From repo root:

- `./demo-start.sh`
or
- `pnpm demo:start`

This starts:

- `core-api` at `http://localhost:4000`
- `channel-ui` at `http://localhost:3000`

Current `channel-ui` scope:

- Login/logout + protected routing (cookie/JWT proxy pattern).
- Product Management UI (products, components, pricing programs).
- Product Management JSON editing uses a shared CodeMirror editor with templates/snippets.
- Policy UI (list/search, new business creation, transaction workspace, endorsement flow, as-of snapshots).
- Billing UI (accounts, invoices, payments, allocations, and policy-financial links).
- Ops UI (global search, events stream, business-events stream, and placeholders for audit/integration tools).

## Security and reliability basics

- JWT auth is required for API endpoints.
- Idempotency keys are used for important POST commands.
- State-changing actions are audited.
- Contractual state is append-only (no destructive overwrite of history).
