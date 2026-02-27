# Codex Agent Instructions (Core Insurance System)

You MUST read all files in /docs before generating or modifying code.

## General mandate

You are implementing a headless P&C insurance core system using a modular monolith architecture.
The system is a System of Record for:

* Product definitions and reusable components
* Policy administration and effective-dated contractual state
* Exposure (insured objects)
* Billing, invoicing, and payments
* Pricing execution via external Python pricing programs
* You MUST follow architectural rules defined in CORE_ARCHITECTURE.md.
* Do not simplify or bypass defined architectural boundaries.

## Implementation priority order

Always implement in this order:

* contracts (schemas, DTOs)
* domain models
* application services (use cases)
* infrastructure (DB, pricing runner)
* interfaces (REST, WebSocket)
* UI (channel apps)

Never implement UI before backend contracts and services exist.

## Domain architecture rules

Use strict layered architecture:

* domain → application → infrastructure → interfaces
* Dependencies must only flow inward.

Domain layer MUST NOT depend on:

* Prisma
* Fastify
* Next.js
* PostgreSQL
* WebSocket
* external APIs

Domain layer contains only business logic.

## Database rules

Use PostgreSQL with Prisma ORM.

Prisma schema is source of truth.

Use UUID primary keys.

Use NUMERIC for money.

All contractual entities MUST use effectiveFrom / effectiveTo fields.

All contractual changes MUST create transaction records (append-only model).

Never destructively overwrite contractual state.

## Product definition rules

ProductVersion MUST be composed from reusable versioned components:

ExposureComponent

CoverageComponent

RuleComponent

PricingProgram reference

ProductVersion MUST store an immutable resolved snapshot when activated.

Active versions are immutable.

## Pricing execution rules

Pricing MUST execute external Python programs via stdin/stdout JSON contract.

Core MUST:

validate pricing input schema

execute pricing runner in isolated subprocess

capture request and response

persist request, response, pricing program version

Pricing programs MUST NOT directly access core database.

## Event and WebSocket rules

System MUST publish domain events via WebSocket /ws/events.

Use standard event envelope:

eventId
eventType
entityType
entityId
occurredAt
data

Events MUST represent completed business facts.

## Authentication rules

Use Local Auth module with:

users table

argon2 password hashing

JWT token issuance

All APIs MUST require authenticated Principal.

Domain logic MUST NOT depend on authentication implementation.

## Coding standards

Use TypeScript strictly (no implicit any)

Use Prisma for persistence

Use Fastify for backend APIs

Use structured logging (pino)

Use Zod for input validation

Follow clean code practices

## Git and file modification rules

Do not modify files outside relevant scope unnecessarily.

Do not introduce unrelated dependencies.

Keep modules small and cohesive.

Do not duplicate logic across modules.

## Migration and extensibility rules

Design all modules so they can later be extracted into separate services without breaking contracts.

Avoid direct DB joins across domain boundaries.

Use stable IDs and API calls instead.

## When uncertain

When requirements are unclear:

do not guess

implement minimal extensible solution

follow architecture principles strictly

## Code review instructions

Here is a **short, Codex-focused Review Guidelines section** tailored for:

**Node.js + Next.js + Fastify + Postgres**
**Modularized monolith**

---

## Review Guidelines

### Architecture

* Respect module boundaries (no cross-module DB access).
* Domain logic must not depend on Fastify/HTTP layer.
* Keep modules independent and replaceable.

### Policy rules

* Never overwrite policy history (use versioning).
* Distinguish clearly between **edit** (no new version) and **change** (new version).
* Enforce valid state transitions (Draft → Quoted → Bound → Active → …).

### API (Fastify)

* Use explicit transaction endpoints (`/bind`, `/endorse`, `/cancel`), not generic PATCH for contract changes.
* Validate all input schemas strictly.
* Handlers must be thin; move logic to services/domain layer.

### Database (Postgres)

* Use transactions for all state-changing operations.
* Enforce invariants with constraints (no overlapping effective periods).
* Avoid business logic in controllers; keep it out of raw SQL where possible.

### Idempotency & consistency

* State-changing operations must be idempotent.
* Use optimistic locking or version columns where relevant.

### Testing

* Unit test domain rules.
* Integration test DB + transaction flows.
* Cover edge cases around effective dates and versioning.

### Observability

* Log with: `policyNumber`, `version`, `transactionType`.
* No PII in logs.
