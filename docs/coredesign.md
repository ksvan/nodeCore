# nodeCore design

This document contains the high level design spec of the system

## Intent

The intent is to develop an property and casualty insurance core system in nodejs and nextjs. This is to be used conceptualy and for training. The solution should be feature complete, possible to use in insurance business process and have a customer facing frontend to login for service and sales purposes and user interfaces for insurance advisors and to make products, managing policies. Designwise it should be possible to scale it technically, allthough it will not be scaled up for this work. 

## Scope to cover

An insurance core system have very many parts. In the defition used here, the core itself is more the system of records, the product, claims and policy core modules. However, to fulfill the intent above a few other surrounding capabilities needs to be in place as well, like a frontend for insurance advisors, a customer facing frontend and an invoicing system.

Businesswise, the solution should cover both Commercial and private insurance. For this setup, we will have the basic selection of products. Vehicle, house, content, health, travel.
We do not intend to ever cover life and pension.

We will not cover claims processes or claims frontends. But the system should provide related APIS for this to be realized outside of the core. 

We will not cover features for accounting, reporting or similar financial processes. Only the invoicing towards the customer. However, the system should provide APIs for an external accounting system to 1) get financial data from the core and 2) provide input to the core of paid invoices.

We will not cover re-insurance or brokers specifically in the core, other than be able to show if the policy is managed by or sold by a broker, partner or whatever channel. We will not cover commissions or settlements towards partner.

## Technical direction

The setup will made so that it can run on a local machine. The tech stack will be as follows

- Nextjs for frontends
- Nodejs for backend
- Postgres for data storage
- Typescript is to be used

### Integrations

The system should provide REST APIs where applicable, following best practises for this. When relevant, websockets should be used to provide event flows, using the same data object definitions as the REST APIs.

The backend and frontend should be loosely coupled with well formed and re-usable APIS. It should be possible to utilize these from future frontend end or totally separate systems. 

All APIs should be well documenteded. Keep a separate markup file for this purpose, keep it updated.

All APIs should be idempotent, have a clear purpose and function. Do not make broad and multi-purpose APIs.

### Persistence layer
PostgreSQL usage (MVP):
- Use PostgreSQL with Prisma ORM.
- Prisma schema is the source of truth; do not hand-write SQL except for rare seed/reference data scripts.
- Use Prisma Migrate for schema changes.
- Add these scripts in the repo:
  - db:migrate  -> prisma migrate dev
  - db:deploy   -> prisma migrate deploy
  - db:reset    -> prisma migrate reset
  - db:studio   -> prisma studio
  - db:seed     -> prisma db seed (optional)
- Store DB connection string in env var DATABASE_URL.
- Add .env.example with a local DATABASE_URL template.
- Backend must connect via PrismaClient and fail fast if DB is unavailable.

### General technical guidance
Build the MVP as a modular monolith with strict domain boundaries. Version and publish all contracts (OpenAPI, WebSocket events, product/policy/pricing schemas). Use Postgres+Prisma with expand/contract migrations and an outbox pattern for event publishing. Enforce idempotency, correlation IDs, and structured logs/metrics from day one. Keep auth token/claims based (local auth now, OIDC later). Pricing runs as isolated versioned Python programs with strict JSON contracts and auditable request/response persistence.

Policy and billing state SHALL be modeled using effective dating and transaction ledger patterns.

All contractual entities (policy, coverage, exposures, premium, billing obligations) SHALL include effectiveFrom and effectiveTo timestamps.

All policy changes SHALL be executed through explicit PolicyTransaction records (NewBusiness, Endorsement, Renewal, Cancellation, Reinstatement).

The system SHALL preserve full history and SHALL NOT destructively overwrite prior contractual state.

The system SHALL be able to reconstruct complete policy state as-of any date.

### Engineering practises

Keep a changelog, follow best practises on formatting and content.

We document code as it is made. Comment each function. Separate sections of code with comments explaning the content of the section. Each file is to be started with a comment explaining its purpose and content.

We make unit and functional testing av we go along. We use service mocking where needed. We provide metrics on test runs, time, coverage, results etc.

Otherwise use common best practises.

Assumptions made on the way should be documented as needed in a separate markdown file. 

Follow DDD with strict aggregate boundaries, API-first contracts, idempotent commands, versioned REST and WebSocket event schemas, effective-dated policy/billing state, full auditability, and security-by-default. Enforce CI quality gates (unit+integration+contract tests, lint/format, code review). Use structured logging with correlation IDs and maintain backward compatible contract evolution.

Use TypeScript everywhere (no any in core domain; allow unknown + explicit parsing).

Pin Node version via .nvmrc (or engines in package.json) and lock dependencies with package-lock.json/pnpm-lock.yaml.

Prefer pnpm (or npm) consistently across repos.

Enforce layered structure:

- domain/ (entities, value objects, invariants, domain services)
- application/ (use-cases/commands, orchestration, DTO mapping)
- infrastructure/ (db, messaging, external adapters)
- interfaces/ (REST controllers, WS handlers)
- Domain layer MUST have no dependency on Next.js, Express/Fastify, DB clients, or frameworks.

### Testing

- Unit tests: Vitest (fast) or Jest.
- API/contract tests: validate OpenAPI + run integration tests using Supertest (Express) or undici/fetch.
- DB integration tests: use Testcontainers (Node) for Postgres (recommended) or docker-compose in CI.
- E2E for Next.js UI: Playwright.

Quality gate:

- No merge if tests fail.

### Git workflow (MVP)

- Use a single shared repo (or monorepo) with a protected `main` branch.
- All work happens on short-lived feature branches: `feature/<ticket>-<short-name>`.
- No direct commits to `main`. Changes reach `main` only via Pull Request (PR).

- Tag releases from `main` using semantic versions: `v0.1.0`, `v0.2.0`, etc.
- `main` must always be deployable.

## Architecture and design

We use domain driven design to have a clearly and well defined structure in modules, services etc, all the way down to how we split code in files. We maintain a separat markup document briefly listing and explaining each domain and keep this up to date.

As input for domains and information model, we use OMG Insurance model for property and casualty business. https://www.omg.org/spec/PC/1.0/About-PC

The information model should be used also for API contracts, data model and data base design and similar, as a consistent red thread.

The architecture should be documented as it evolves in a separate markdown document.

### The domains

The domains are important to follow and be consistent in during design and development.
They are all defined in the domainmodel.md file, same folder.

### User interface

Build all frontends as loosely coupled channel apps that call the core via versioned APIs and domain events only (no DB access). The core is headless and owns domain state/validation; workflow/orchestration and UX live outside the core. Require idempotent commands, stable IDs, backward compatible contract evolution, and tolerance for eventual consistency.

UIs are separate channel apps; they call versioned APIs and subscribe to domain events only.

No direct DB access from UI apps.

Core owns all state transitions and validations; UI only collects input + orchestrates calls.

All commands must be idempotent (client-generated requestId) and return stable identifiers.

UIs may use read models/caching and must tolerate eventual consistency.

Minimum user interfaces needed are defined in the userinterfaces.md file, same folder

### Authentication

Not a full iam or idp ready yet or needed for this testing. Instead Implement “Local Auth” for this MVP. Provide /auth/login with email+password stored in the core DB (argon2id hash) and issue short-lived JWT access tokens. JWT claims MUST follow OIDC conventions (sub, iss, aud, exp, iat, roles). Core services MUST treat authentication as token verification and map requests to a Principal (userId + roles/claims). Business logic MUST NOT depend on the local auth implementation. This module SHALL be replaceable by an external OIDC IdP later without changing domain logic or API authorization semantics.

### Pricing and product design

Pricing Engine (MVP): Pricing for each ProductVersion SHALL be implemented as a versioned Python program executed by the core via a strict JSON contract. The core sends a PricingRequest JSON to the pricing program (stdin) and receives a PricingResponse JSON (stdout). The data shapes in requests SHALL be aligned with the core REST read models (policy snapshot, exposures, coverages) to minimize mapping. The pricing program SHALL be deterministic and side-effect free. Execution SHALL be sandboxed (no network), time/memory limited, and treated as untrusted code. The core SHALL persist the request, response, pricing program identifier/hash, and timestamps for audit and reproducibility.

Each ProductVersion SHALL define explicit JSON schemas for:

- policySchema: defines required data to create and issue a valid policy
- exposureSchemas: defines structure of each exposure type
- pricingInputSchema: defines the exact JSON contract passed to the pricing program

The core SHALL validate policy data against policySchema before issuing a policy.

The core SHALL construct pricing input JSON according to pricingInputSchema and pass it to the pricing program.

The pricing program SHALL NOT define or modify the input schema; it MUST conform to the product-defined pricingInputSchema.

Schemas SHALL be versioned and stored as part of product configuration.

#### Reusable Product Components (MVP)

The key is to make reusable, versioned “building blocks” first-class, and then let ProductVersion compose them by reference.

ProductVersion SHALL be composed from reusable, versioned components.

Define component libraries:

- CoverageComponent (coverage definition)
- ExposureComponent (insured object schema)
- RuleComponent (validation/eligibility rules)

Each component SHALL have: { componentId, version, status(draft/released), schema/definition, metadata }.
Released component versions SHALL be immutable.

ProductVersion SHALL reference specific component versions (no "latest"):

- coverageRefs: [{componentId, version, configOverrides}]
- exposureRefs: [{componentId, version, configOverrides}]
- ruleRefs: [{componentId, version, configOverrides}]

ProductVersion composition SHALL produce the effective:

- policySchema (built from exposure + policy requirements)
- validationRules (merged rule set)
- pricingInputSchema (derived subset needed by pricing)

The core SHALL resolve component references at runtime (or compile-time into an immutable resolved ProductVersion snapshot) and validate that referenced fields exist and do not conflict.
