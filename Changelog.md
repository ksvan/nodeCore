# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

* Planned: Node-RED nodes for consuming WebSocket events and calling nodeCore APIs.
* Planned: MCP interface for package metadata and API exposure to agents.
* Planned: Sidecar AI agent integration (LangGraph) with selectable LLM.

## [0.2.x] - 2026-02-28

### Added

* Structured Policy Administration model with explicit transaction ledger, draft tables, effective-dated state, and as-of snapshot support.
* Policy Administration APIs for policy creation, transaction drafting, draft replace flows (risks, coverages, terms), validation, commit, and snapshot retrieval.
* Versioned pricing contracts (`PricingRequest`/`PricingResponse`) and Python pricing runner integration via stdin/stdout.
* Pricing run audit persistence including request/response payloads, file reference/hash, duration, success/error summary, and transaction linkage.
* Policy transaction rating integration with commit-time `PolicyPremium` effective-dated persistence and rating-related events.
