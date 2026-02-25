# Domain model

#### Product Configuration

Defines what can be sold/issued.

Coverages, perils, limits, deductibles, exclusions, clauses/wordings

Product versioning / effective dating

Rating factor definitions (not the pricing math engine itself unless you choose to keep it inside)

Document requirements (what documents must exist), but not the rendering service

####  Party & Customer (Master Data)

System of record for parties referenced by policies and billing.

Person / Organization, addresses, contacts

Roles & relationships (policyholder, insured, additional insured, payor, etc.)

Minimal compliance attributes needed for record-keeping (not full KYC workflows)

####  Exposure & Insured Objects

System of record for what is insured (works for both personal and commercial).

Vehicles, properties/buildings, locations, contents/schedules

Liability exposures / operations descriptors

Sum insured, risk attributes, attachments to policy/coverage

####  Quoting & Underwriting Record (Optional but common)

If you truly only want “policy record”, you can keep this thin or omit it.

Quote as a record (pre-policy) and its linkage to issued policy

Underwriting decisions as record (accept/decline, conditions) without workflow/case management

External decision inputs stored for audit (“this was checked”), but orchestration stays outside

####  Policy Administration (Policy System of Record)

The heart: policy lifecycle and contractual state.

Policy / term / transactions (new business, endorsement/MTA, renewal, cancellation, reinstatement)

Coverage structure (policy → lines → coverages → modifiers)

Effective-dated state, transaction ledger / audit trail

Policy documents metadata (what was issued), but not generation/distribution

####  Pricing & Premium Calculation (Inside-core, but kept “pure”)

You still need authoritative premium amounts for billing and for policy record.

Premium calculation outputs per transaction (incl. proration)

Taxes/fees/surcharges as amounts (rules can be configured in Product)

Persisted premium breakdown for audit and downstream finance
(If you prefer: allow an external pricing engine, but core must store the authoritative results.)

#### Billing & Collections (Customer-facing Finance)

Included per your requirement.

Account (payer account), invoicing schedules, installments

Invoice issuance records, dunning state (basic), payment allocation, refunds

Payment methods tokens/refs (don’t store raw card data), autopay flags

Receivables ledger (sub-ledger) sufficient for customer billing correctness

#### Claims Linkage (Policy/Exposure reference only)

Since claims handling is outside, core only supports “relationship & verification”.

Coverage verification endpoints/data (as-of date)

Claim reference registry (claim id, claimant references) if needed

Policy/exposure pointers and snapshots for “what was covered when”
(No reserves, payments, adjuster diary, fraud, etc. in core.)