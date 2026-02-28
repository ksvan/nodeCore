# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

* Planned: Node-RED nodes for consuming WebSocket events and calling nodeCore APIs.
* Planned: MCP interface for package metadata and API exposure to agents.
* Planned: Sidecar AI agent integration (LangGraph) with selectable LLM.
* Root demo startup script (`demo-start.sh` / `pnpm demo:start`) to run `core-api` and `channel-ui` together for local demos.
* UI-2 Policy Workspace in `apps/channel-ui`:
  - Policy search/list page.
  - New Business creation flow (policy + NB draft transaction).
  - Transaction workspace for draft risks, coverages, and coverage terms (replace semantics), plus validate/rate/commit actions.
  - Policy detail page with transaction list, as-of snapshot viewer, and endorsement draft creation.

### Changed

* Channel UI policy navigation now links directly to policy list and NB creation routes.
* Policy UI explicitly documents backend contract gap: no draft read endpoint for risks/coverages/terms, so client prefill after reload is limited.

## [0.3.0] - 2026-02-28

### Added

* UI-1 channel app bootstrap at `apps/channel-ui` using Next.js App Router + TypeScript.
* Login/logout UI with secure httpOnly cookie flow via Next route handlers (`/api/auth/login`, `/api/auth/logout`) and route protection middleware.
* API-only channel architecture with core proxy route (`/api/core/[...path]`) that forwards JWT and correlation IDs to `core-api`.
* Product Management UI module:
  - Products list/create and product detail with versions list/create.
  - Product version detail with status actions, component references, and snapshot visibility.
  - Component management pages (list/create, version list/create with JSON editing).
  - Pricing program pages (list/create, version list/create with `fileRef` and JSON schemas).
* Optional dev WebSocket events panel in channel UI (`NEXT_PUBLIC_CORE_WS_URL`).
* Core auth endpoint `POST /auth/login` for local JWT issuance from persisted users.
* Additional Product Management read/query APIs used by channel UI:
  - product versions list/get
  - product version component refs list
  - product version snapshot get
  - component get + version list
  - pricing program list/get + version list

### Changed

* Updated architecture and information model diagrams to reflect Policy ↔ Billing integration (`BillingObligation`, obligation-backed invoice generation, and financial position/event flow).
* Added junior-friendly onboarding docs for technical/infrastructure setup and high-level architecture.
* Added a dedicated UI integration architecture diagram: `docs/architecture/channel-ui-integration.svg`.

## [0.2.x] - 2026-02-28

### Added

* Structured Policy Administration model with explicit transaction ledger, draft tables, effective-dated state, and as-of snapshot support.
* Policy Administration APIs for policy creation, transaction drafting, draft replace flows (risks, coverages, terms), validation, commit, and snapshot retrieval.
* Versioned pricing contracts (`PricingRequest`/`PricingResponse`) and Python pricing runner integration via stdin/stdout.
* Pricing run audit persistence including request/response payloads, file reference/hash, duration, success/error summary, and transaction linkage.
* Policy transaction rating integration with commit-time `PolicyPremium` effective-dated persistence and rating-related events.
