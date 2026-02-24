# Architecture princples

The system is a headless, event-driven, domain-oriented P&C insurance System of Record that owns policy, party, exposure, premium, and billing state, exposes all functionality via versioned APIs and domain events, and remains fully decoupled from UI, workflow, claims, and analytics systems.


# Core System Architecture Principles

## 1. System role and responsibility

The core system SHALL be implemented as a **headless System of Record** responsible for:

* Policy contractual state
* Product configuration and coverage structure
* Party and insured object records
* Premium and financial obligation records
* Billing accounts, invoices, payments, and allocations

The core SHALL be the **authoritative source of truth** for these domains.

The core SHALL NOT implement:

* User workflow orchestration
* Advisor/customer journey logic
* Claims handling logic
* Reporting, analytics, or BI logic
* Broker, partner, commission, or reinsurance logic

These SHALL exist in external systems that integrate via APIs and events.

---

## 2. Architectural style

The system SHALL follow these architectural patterns:

* Domain-Driven Design (DDD)
* Clear bounded contexts aligned with business domains
* API-first architecture
* Event-driven integration model
* Headless services (no direct UI dependency)
* Stateless service execution where possible

The architecture SHALL separate:

* Write model (command side)
* Read model (query side)
* Integration/event model

---

## 3. Domain ownership and isolation

Each domain SHALL:

* Own its data and persistence
* Enforce its own invariants and validation
* Expose functionality only through APIs and events

No domain SHALL directly access another domain’s database.

Cross-domain interaction SHALL use:

* APIs for synchronous needs
* Events for asynchronous propagation

---

## 4. Transaction and consistency model

The system SHALL use:

* Strong consistency within a single aggregate boundary
* Eventual consistency across domains

Distributed transactions across domains SHALL NOT be used.

Instead, use:

* Domain events
* Idempotent command handling
* Retry-safe operations

---

## 5. API design principles

All business functionality SHALL be exposed via versioned APIs.

APIs SHALL follow these principles:

* Stable identifiers (UUID or equivalent)
* Idempotent commands
* Explicit command intent (IssuePolicy, CancelPolicy, AllocatePayment)
* Separation of commands and queries
* Backward-compatible evolution

APIs SHALL be the only mechanism for modifying core state.

Direct database access from external systems is strictly prohibited.

---

## 6. Event model

The core SHALL publish domain events for all state changes relevant to external systems.

Examples include:

* PolicyIssued
* PolicyTransactionCommitted
* PolicyCancelled
* InvoicePosted
* PaymentReceived
* PaymentAllocated
* PartyCreated
* ExposureAdded

Events SHALL:

* Represent completed business facts
* Be immutable
* Include stable identifiers
* Include effective dates and timestamps

Events SHALL enable external systems to build their own read models.

---

## 7. Persistence principles

Persistence SHALL follow these rules:

* Each aggregate SHALL have a single authoritative persistence boundary
* All state changes SHALL be auditable
* Full history SHALL be preserved (no destructive updates)
* Effective dating SHALL be supported for policy state

The system SHALL support reconstruction of state "as-of" any point in time.

---

## 8. Identity and identifier strategy

All core entities SHALL use globally unique, immutable identifiers.

Identifiers SHALL:

* Never be reused
* Never be reassigned
* Be opaque (no embedded business meaning)

External systems SHALL reference entities by these identifiers.

Human-readable numbers (policy number, invoice number) SHALL be treated as attributes, not identifiers.

---

## 9. Temporal model (critical for insurance)

All business entities SHALL support temporal attributes:

* effectiveFrom
* effectiveTo
* createdAt
* committedAt

Policy state SHALL be reconstructable for any effective date.

Policy transactions SHALL represent atomic contractual changes.

---

## 10. Audit and traceability

The system SHALL maintain a complete audit trail of:

* All state changes
* Who/what initiated the change
* When the change occurred
* Correlation identifiers

Audit data SHALL be queryable.

No business state SHALL be modified without audit trace.

---

## 11. Integration principles

External systems SHALL integrate via:

* Versioned REST or GraphQL APIs
* Domain event subscriptions

The core SHALL NOT depend on external systems for correctness of its internal state.

External failures SHALL NOT corrupt core state.

---

## 12. UI and channel architecture

All UI applications SHALL be separate channel applications.

Channel applications SHALL:

* Call core APIs
* Subscribe to core events
* Maintain their own read models if needed

The core SHALL NOT contain UI logic or UI state.

---

## 13. Business transaction model

All contractual changes SHALL occur through explicit business transactions.

Examples:

* NewBusiness transaction
* Endorsement transaction
* Renewal transaction
* Cancellation transaction

Transactions SHALL be atomic and auditable.

---

## 14. Data exposure principles

The core SHALL expose its data via:

* Query APIs
* Domain events

External systems SHALL NOT read the core database directly.

---

## 15. Versioning and evolution

The system SHALL support:

* Backward compatible API evolution
* Product versioning
* Policy versioning
* Coverage versioning

Historical policies SHALL remain valid under their original product definitions.

---

## 16. Technology neutrality

The architecture SHALL NOT assume specific frameworks or vendors.

It SHALL be implementable using standard modern backend technologies.

---
