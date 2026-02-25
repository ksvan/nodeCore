# user interfaces
At minimum, this needs to be in place. 
Lets use tailwind css for this.

The system should allow for choosing between multiple styles and color schemes.
Default design should be slick and modern, but professional, with good contrast, font and easy to work with.
Fulfill accessability requirements.

We will only implement english for now, but the UIs should be able to be multi language, e.g user picks.

    ## UI scope: Business actions the channel apps must support

### A) Party & Customer

**Actions (commands)**

* CreatePerson / UpdatePerson
* CreateOrganization / UpdateOrganization
* AddOrUpdateAddress
* AddOrUpdateContactPoint (email/phone)
* AssignRoleToParty (Policyholder/Insured/Payor/AdditionalInsured)
* MergeParty (optional, admin-only)

**Views**

* Party search (by name, national id/org no, address, external ref)
* Party detail (roles, relationships, contact preferences)

---

### B) Product / Reference selection (read-only UI)

**Actions**

* BrowseProducts (effective-dated)
* ViewCoverageOptions (limits/deductibles/clauses)

**Views**

* Product browser (read-only)
* Coverage option picker (read-only)

### B2) Product Management
This part is to make products and manage and make the re-usable componenents across them
  * Products
  * Coverage Components
  * Exposure Components
  * Rule Components
  * Pricing Programs
  * Validation & Simulation


---

### C) Exposure / Insured Objects

**Actions**

* CreateExposure (generic)
* AddVehicle / UpdateVehicle / RemoveVehicle
* AddPropertyOrLocation / UpdatePropertyOrLocation / RemovePropertyOrLocation
* AddScheduleItem / UpdateScheduleItem / RemoveScheduleItem (commercial schedules)
* AttachExposureToPolicyTransaction

**Views**

* Exposure list per policy/quote
* Exposure detail (risk attributes, location hierarchy)

---

### D) Quote-to-Policy Record (if you keep quotes)

**Actions**

* CreateQuote
* UpdateQuote
* CalculatePremium (returns premium breakdown snapshot)
* ConvertQuoteToPolicy (Bind/Issue)

**Views**

* Quote summary (coverages, exposures, premium)
* Quote comparison (optional)

---

### E) Policy Administration (System of Record)

**Actions**

* CreatePolicyDraft (New Business)
* AddOrUpdateCoverageSelection (limits/deductibles/clauses)
* RatePolicyTransaction (recalculate premium for current transaction)
* ValidatePolicyTransaction (server-side validations)
* IssuePolicy (commit transaction)
* EndorsePolicy (create MTA transaction effective-dated)
* CancelPolicy (with reason + effective date)
* ReinstatePolicy (if allowed)
* RenewPolicy (create renewal term, accept renewal)
* VoidOrCorrectTransaction (admin-only, strict audit)

**Views**

* Policy search (policy no, party, vehicle reg, address, org no)
* Policy summary (status, term dates, coverages, exposures, premium)
* Transaction timeline (NB/MTA/Renewal/Cancel with effective dates)
* Policy “as-of” view (state at a given date)

---

### F) Billing & Collections (Customer-facing finance)

**Actions**

* CreateBillingAccount (payer)
* ConfigureBillingPlan (annual/quarterly/monthly, invoice day, method)
* GenerateInvoiceSchedule (per policy term/transaction)
* PostInvoice (issue invoice record)
* RegisterPayment (manual/posted from payment provider)
* AllocatePayment (to invoices)
* CreateRefund (and allocate)
* WriteOffInvoice (admin-only)
* PauseOrResumeDunning (basic control)
* ChangePayor (move policy to new billing account, rules apply)

**Views**

* Billing account overview (balance, open invoices, payment history)
* Invoice detail (line items, due date, status)
* Payment detail (allocations)
* Dunning status (basic)

---

### G) Coverage Verification (for claims system / external users)

**Actions**

* VerifyCoverageAsOf (party + policy + date + exposure)
* GetPolicyCoverageSnapshot (as-of date, for claim intake)

**Views**

* Coverage verification screen (read-only, audit logged)

---

### H) Operational / Admin (technical UI only)

**Actions**

* SearchById (policyId, transactionId, invoiceId)
* ViewAuditTrail (who/when/what changed)
* ReplayOrReprocessEvent (admin-only, if supported)
* ManageReferenceData (codes, limited)

**Views**

* Ops dashboard (integration health, errors, retries)

---

## Loose coupling requirements (attach to the same section)

* UIs are separate channel apps; they call **versioned APIs** and subscribe to **domain events** only.
* No direct DB access from UI apps.
* Core owns all state transitions and validations; UI only collects input + orchestrates calls.
* All commands must be **idempotent** (client-generated requestId) and return stable identifiers.
* UIs may use read models/caching and must tolerate **eventual consistency**.


## Screen list (channel apps)
To supplement and guide the design of above needs. 

### 1) Global

* **Home / Workbench** (shortcuts, recent items)
* **Global Search** (policy / party / exposure / invoice / payment)
* **ID Lookup** (admin) (search by internal UUIDs)

### 2) Party & Customer

* **Party Search**
* **Create Party** (Person / Organization)
* **Party Detail** (tabs: Overview, Roles, Addresses, Contacts, Linked Policies, Audit)

### 3) Product (read-only)

* **Product Browser** (effective-dated)
* **Coverage Options Viewer** (limits/deductibles/clauses/wordings)

### 4) Exposure

* **Exposure List** (per quote/policy transaction)
* **Exposure Detail**

  * Vehicle editor
  * Property/Location editor (incl. location hierarchy)
  * Schedule items editor (commercial)

### 5) Quote / Draft (if used)

* **Quote Workspace**

  * Parties & roles
  * Exposures
  * Coverage selection
  * Premium summary + recalc
  * Convert to policy

*(If you skip quotes, the “Policy Workspace (Draft)” below is used from step 1.)*

### 6) Policy Administration

* **Policy Search**
* **Policy Summary** (read-only snapshot + key dates/status)
* **Policy Workspace (Draft Transaction)**
  “single place” to build/modify a transaction:

  * parties/roles
  * exposures
  * coverages
  * premium calc + validation results
  * issue/commit actions
* **Endorsement Workspace** (MTA)
* **Cancellation / Reinstatement** screen
* **Renewal Workspace** (create renewal, accept/decline, adjustments)
* **Transaction Timeline** (NB/MTA/Renewal/Cancel; as-of viewer)
* **Documents Registry** (issued docs list + external links/refs)

### 7) Billing & Collections

* **Billing Account Search**
* **Billing Account Workspace**

  * billing plan (frequency, due day, payment method ref)
  * invoices list
  * payments list
  * balance
* **Invoice Detail**
* **Record Payment / Allocation** (manual + provider callback viewer)
* **Refund Screen**
* **Dunning Status** (basic controls + history)

### 8) Coverage Verification (for claims/external)

* **Coverage Verification** (as-of lookup, audit logged)
* **Policy Coverage Snapshot Viewer** (read-only)

### 9) Ops / Admin (technical)

* **Integration Monitor** (failures, retries, dead-letter)
* **Audit Viewer** (who/when/what + correlationId/requestId)
* **Reference Data Admin** (codes/tables)
* **Event Replay / Reprocess** (only if supported)

---
