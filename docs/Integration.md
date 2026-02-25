# Integration

## API surface (grouped by domain)

Below is a clean contract surface Codex can scaffold (REST-ish). Names are indicative; adjust naming conventions as you like.

### A) Party API

**Commands**

* `POST /parties/persons`
* `POST /parties/organizations`
* `PATCH /parties/{partyId}`
* `PUT /parties/{partyId}/addresses/{addressId}`
* `PUT /parties/{partyId}/contacts/{contactId}`
* `POST /parties/{partyId}/roles` (assign role to policy/quote context if needed)
* `POST /parties/merge` (admin)

**Queries**

* `GET /parties?query=...`
* `GET /parties/{partyId}`
* `GET /parties/{partyId}/policies`

---

### B) Product (read-only) API

* `GET /products?asOfDate=YYYY-MM-DD`
* `GET /products/{productId}?asOfDate=...`
* `GET /products/{productId}/coverages?asOfDate=...`
* `GET /coverages/{coverageSpecId}/options?asOfDate=...` (limits/deductibles/etc.)

---

### C) Exposure API

(Option 1: exposures are owned inside a quote/policy transaction; use the transaction endpoints below.
Option 2: exposures as standalone records; then:)

**Commands**

* `POST /exposures`
* `PATCH /exposures/{exposureId}`
* `POST /exposures/{exposureId}/schedule-items`
* `PATCH /exposures/{exposureId}/schedule-items/{itemId}`
* `DELETE /exposures/{exposureId}/schedule-items/{itemId}`

**Queries**

* `GET /exposures/{exposureId}`
* `GET /exposures?policyId=...` or `?transactionId=...`

---

### D) Quote API (optional)

**Commands**

* `POST /quotes`
* `PATCH /quotes/{quoteId}`
* `POST /quotes/{quoteId}/rate` (idempotent, returns premium snapshot)
* `POST /quotes/{quoteId}/validate`
* `POST /quotes/{quoteId}/convert-to-policy`

**Queries**

* `GET /quotes?query=...`
* `GET /quotes/{quoteId}`

---

### E) Policy Administration API (core)

**Commands (transaction-based)**

* `POST /policies/drafts` (new business draft transaction)
* `POST /policies/{policyId}/transactions/endorsement`
* `POST /policies/{policyId}/transactions/renewal`
* `POST /policies/{policyId}/transactions/cancellation`
* `POST /policies/{policyId}/transactions/reinstatement`

**Mutations within a transaction**

* `PUT /policy-transactions/{txId}/parties` (roles + refs)
* `PUT /policy-transactions/{txId}/exposures`
* `PUT /policy-transactions/{txId}/coverages`
* `POST /policy-transactions/{txId}/rate`
* `POST /policy-transactions/{txId}/validate`
* `POST /policy-transactions/{txId}/issue` (commit)

**Queries**

* `GET /policies?query=...`
* `GET /policies/{policyId}`
* `GET /policies/{policyId}/transactions`
* `GET /policy-transactions/{txId}`
* `GET /policies/{policyId}/snapshot?asOfDate=YYYY-MM-DD` (as-of view)

---

### F) Pricing / Premium API

(If pricing is invoked via policy/quote rate endpoints you may not need a separate API.)

* `GET /policy-transactions/{txId}/premium` (breakdown)
* `GET /policies/{policyId}/premium?asOfDate=...` (for “what is premium at date”)

---

### G) Billing & Collections API

**Commands**

* `POST /billing/accounts` (create billing account for a payer/party)
* `PATCH /billing/accounts/{accountId}` (plan, payment method ref)
* `POST /billing/accounts/{accountId}/invoice-schedules/generate`
* `POST /billing/invoices` (issue/post invoice record; or `POST /billing/accounts/{accountId}/invoices`)
* `POST /billing/payments` (register payment; includes providerRef + amount)
* `POST /billing/payments/{paymentId}/allocate`
* `POST /billing/refunds`
* `POST /billing/invoices/{invoiceId}/writeoff` (admin)
* `POST /billing/accounts/{accountId}/dunning/pause` (basic)
* `POST /billing/accounts/{accountId}/dunning/resume`
* `POST /billing/accounts/{accountId}/change-payor` (move policy billing responsibility)

**Queries**

* `GET /billing/accounts?query=...`
* `GET /billing/accounts/{accountId}`
* `GET /billing/accounts/{accountId}/invoices`
* `GET /billing/invoices/{invoiceId}`
* `GET /billing/accounts/{accountId}/payments`
* `GET /billing/payments/{paymentId}`

---

### H) Coverage Verification API

* `POST /coverage/verify`
  Input: policyId or party+exposure identifiers, lossDate/asOfDate
  Output: coverage in force + key terms + policy snapshot reference
* `GET /coverage/policy-snapshot/{snapshotId}` (optional if you persist snapshots)

---

### I) Documents Registry API (metadata only)

* `GET /policies/{policyId}/documents`
* `POST /policies/{policyId}/documents` (register external doc link/ref + type + effective date)

---

### J) Ops/Admin APIs

* `GET /ops/health`
* `GET /ops/audit?entityId=...`
* `GET /ops/integration/failures`
* `POST /ops/integration/retry/{failureId}`
* `POST /ops/events/reprocess` (admin)

---

## Contract rules (add these as bullets in the doc)

* Every command supports `Idempotency-Key` (or `requestId` in body) and returns stable IDs.
* Every response includes `correlationId` and `version`.
* APIs are versioned (`/v1/...`) and evolve backward-compatibly.
* UI apps build read-optimized views using query endpoints and/or subscribed domain events; never DB access.

If you want, I can also provide a **minimal set of domain events** that the UIs should subscribe to in order to keep their read models current (e.g., `PolicyIssued`, `PolicyTransactionCommitted`, `InvoicePosted`, `PaymentAllocated`, etc.).


## MVP Event Publishing API (WebSocket)

The core SHALL expose a WebSocket endpoint for consumers (UI/channel apps) to receive domain events.

### Endpoint
GET /ws/events

### Auth
Same auth mechanism as REST (e.g., bearer token). Connection MUST be rejected if unauthorized.

### Message format
All messages SHALL use JSON and a common envelope:

{
  "eventId": "uuid",
  "eventType": "PolicyIssued | PolicyUpdated | InvoicePosted | PaymentAllocated | ...",
  "eventVersion": "v1",
  "occurredAt": "ISO-8601 timestamp",
  "effectiveAt": "ISO-8601 date/time (optional)",
  "entityType": "Policy | BillingAccount | Invoice | Payment | Party | Exposure",
  "entityId": "uuid",
  "action": "created | updated | deleted",
  "data": { ... }
}

### Data payload
The `data` field SHALL reuse the same JSON object shapes (DTOs) as the REST query responses for the referenced entity.
- For "created/updated": include the full current representation (REST GET shape).
- For "deleted": include at minimum { "id": "<uuid>" } plus identifying fields if available.

### Subscription / filtering
After connect, the client SHALL send a subscription message:

{
  "type": "subscribe",
  "filters": {
    "entityTypes": ["Policy", "Invoice", "Payment"],
    "eventTypes": ["PolicyIssued", "InvoicePosted"],
    "entityIds": ["uuid1", "uuid2"],
    "sinceEventId": "uuid (optional)",
    "sinceOccurredAt": "ISO-8601 (optional)"
  }
}

Server SHALL respond with:

{ "type": "subscribed", "subscriptionId": "uuid" }

Filtering is best-effort. If filters are omitted, server MAY default to a safe minimal set.

### Reliability (MVP)
Delivery is at-most-once over WebSocket. Clients MUST be able to resync using REST queries.
Optionally support replay by accepting `sinceOccurredAt` and sending a bounded backlog if available.

### Heartbeat
Server SHALL send a ping every N seconds and clients SHALL reply with pong (or equivalent).

### Event set (MVP minimum)
Policy: PolicyIssued, PolicyChanged, PolicyCancelled
Billing: InvoicePosted, PaymentReceived, PaymentAllocated
Party/Exposure: PartyUpdated, ExposureUpdated