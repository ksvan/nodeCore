# Core Architecture (High Level)

This is a short introduction to how the insurance core is designed.

## What this system is

`nodeCore` is a **headless insurance core system**.
It is the system of record for:

- products and pricing configuration
- policy contracts and policy changes
- billing, invoices, and payments

It does **not** include UI workflow engines, claims processing, or analytics.

## Main design style

- Modular monolith (single deployable app, clear module boundaries)
- Domain-driven structure (policy, product, pricing, billing are separate domains)
- API-first (REST + WebSocket events)
- Event-driven integration (important business facts are published as events)

## The 4 layers

Each module follows the same layered pattern:

1. `domain`  
Business rules and invariants.

2. `application`  
Use cases (commands/queries), orchestration, and ports.

3. `infrastructure`  
Database repositories, external adapters (for example Python pricing runner).

4. `interfaces`  
Fastify routes, request validation, auth, and WebSocket gateway.

Why this matters: it keeps business logic independent from frameworks and easier to test.

## Key business patterns in this core

- **Append-only ledger for policy transactions**: changes are recorded, not overwritten.
- **Effective dating**: contractual records use active date windows (`effectiveFrom` / `effectiveTo`).
- **As-of snapshots**: policy state can be reconstructed for a specific date.
- **Versioned product + pricing**: active policy versions keep stable references.
- **Auditability**: pricing runs, billing operations, and transactions are traceable.

## How modules connect

- Policy can call pricing through an application port.
- Policy can trigger billing obligations through an application port.
- Billing remains its own domain and data owner.
- Cross-domain communication should happen through service interfaces and events, not direct DB coupling.

## UI integration

- Channel UI (`apps/channel-ui`) is a separate app.
- UI never reads the database directly.
- UI calls core APIs (REST) and can listen to WebSocket event streams (`/ws/events`, `/ws/business-events`).
- `/ws/events` is the broad stream; `/ws/business-events` is curated business facts only.
- Login uses `/auth/login` via a UI proxy route that stores JWT in an httpOnly cookie.
- Protected pages forward auth to core through API proxy handlers.
- Business-events stream supports JWT auth via bearer token or auth cookie.
- Current UI modules:
  - Product Management workspace (UI-1).
  - Product Management JSON editing uses a shared code editor with templates/snippets (UI-4.2).
  - Policy Workspace (UI-2): policy list/search, NB + endorsement draft flows, transaction editing (risks/coverages/terms), rate/commit, and as-of snapshot view.
  - Billing Workspace (UI-3): accounts, invoices, payments, allocations, and policy financial drill-in links.
  - Ops Workspace (UI-4): global search, events viewers, and operational placeholders (audit/integration failures pending backend endpoints).

## For new contributors

Start by reading:

1. `docs/README_FOR_CODEX.md`
2. `docs/AGENT_INSTRUCTIONS.md`
3. `docs/coredesign.md`
4. `docs/domainmodel.md`

Then inspect `apps/core-api/src` by layer, not by file name alone.
