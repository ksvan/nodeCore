# Codex Agent Instructions (Core Insurance System)

You MUST read all files in /docs before generating or modifying code.

1. General mandate

You are implementing a headless P&C insurance core system using a modular monolith architecture.

The system is a System of Record for:

Product definitions and reusable components

Policy administration and effective-dated contractual state

Exposure (insured objects)

Billing, invoicing, and payments

Pricing execution via external Python pricing programs

You MUST follow architectural rules defined in CORE_ARCHITECTURE.md.

Do not simplify or bypass defined architectural boundaries.

2. Implementation priority order

Always implement in this order:

contracts (schemas, DTOs)

domain models

application services (use cases)

infrastructure (DB, pricing runner)

interfaces (REST, WebSocket)

UI (channel apps)

Never implement UI before backend contracts and services exist.

3. Domain architecture rules

Use strict layered architecture:

domain → application → infrastructure → interfaces

Dependencies must only flow inward.

Domain layer MUST NOT depend on:

Prisma

Fastify

Next.js

PostgreSQL

WebSocket

external APIs

Domain layer contains only business logic.

4. Database rules

Use PostgreSQL with Prisma ORM.

Prisma schema is source of truth.

Use UUID primary keys.

Use NUMERIC for money.

All contractual entities MUST use effectiveFrom / effectiveTo fields.

All contractual changes MUST create transaction records (append-only model).

Never destructively overwrite contractual state.

5. Product definition rules

ProductVersion MUST be composed from reusable versioned components:

ExposureComponent

CoverageComponent

RuleComponent

PricingProgram reference

ProductVersion MUST store an immutable resolved snapshot when activated.

Active versions are immutable.

6. Pricing execution rules

Pricing MUST execute external Python programs via stdin/stdout JSON contract.

Core MUST:

validate pricing input schema

execute pricing runner in isolated subprocess

capture request and response

persist request, response, pricing program version

Pricing programs MUST NOT directly access core database.

7. Event and WebSocket rules

System MUST publish domain events via WebSocket /ws/events.

Use standard event envelope:

eventId
eventType
entityType
entityId
occurredAt
data

Events MUST represent completed business facts.

8. Authentication rules

Use Local Auth module with:

users table

argon2 password hashing

JWT token issuance

All APIs MUST require authenticated Principal.

Domain logic MUST NOT depend on authentication implementation.

9. Coding standards

Use TypeScript strictly (no implicit any)

Use Prisma for persistence

Use Fastify for backend APIs

Use structured logging (pino)

Use Zod for input validation

Follow clean code practices

10. Git and file modification rules

Do not modify files outside relevant scope unnecessarily.

Do not introduce unrelated dependencies.

Keep modules small and cohesive.

Do not duplicate logic across modules.

11. Migration and extensibility rules

Design all modules so they can later be extracted into separate services without breaking contracts.

Avoid direct DB joins across domain boundaries.

Use stable IDs and API calls instead.

12. When uncertain

When requirements are unclear:

do not guess

implement minimal extensible solution

follow architecture principles strictly