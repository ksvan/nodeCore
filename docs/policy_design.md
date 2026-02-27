# This file contains the more important info on policy design

both for UI and core layer

## Policy Edit (Administrative Update) / service

Some operations are considered service or admin of the policy, without actually changing the contract.
These things should always be fast, easy and available in both APIs and UI. Quite often calls on this.

Use **edit** when the change does **NOT** affect contract, risk, or premium.

Examples:

* Update email or phone number
* Update mailing address (if not risk-relevant)
* Fix spelling errors in name
* Correct typo in registration number (no risk change)
* Add internal note
* Update communication preference
* Attach documents

Characteristics:

* No premium recalculation
* No underwriting
* No new policy version
* No new policy document
* Logged in audit trail only
* No change in exposure, insurable object

---

## Policy Change (Endorsement / New Version)

This is typical when the customer wants to change coverage, exposure or similar affecting risk/price.
Quite often because a change in vehicle or property, or a need to reduce price or increase coverage due to risk changes.

Use **change** when the update affects the insurance contract.
When changing, it is a new and fresh version of the same policy, with a new effective date. Policy number stays the same.
The new policy will be active at the given date. This will change the state of both policies, see lifecycle section.

Examples:

* Add or remove coverage
* Change deductible
* Change insured object (car, house, asset)
* Add or remove driver
* Change sum insured
* Change usage (private → commercial)
* Change risk address
* Change policyholder
* Cancel or reinstate policy
* Change effective date or period

Characteristics:

* Premium recalculation required
* May require underwriting
* New policy version created
* New policy document generated
* Effective-dated
* Full version history retained

---

### Simple Decision Rule

If the change affects:

* Premium
* Risk
* Coverage
* Insured object
* Legal party
* Policy period

→ It is a **Policy Change (new version)**

If not → It is a **Policy Edit**

---

## Policy States (Definitions) - Lifecycle

The changes should happen automatically in the process. Default is draft when made initially.
If offered to the customer, via an advisor or digitally, it should become Quoted etc, as laid out below.

**Draft**
Policy is being created or edited. Not offered or legally binding.

**Quoted**
Premium and coverage calculated and offered to customer. Not yet accepted.

**Bound**
Customer accepted the quote. Contract is legally binding but may not be active yet.

**Active (In Force)**
Policy is currently effective. Coverage is active and claims are allowed.

**Cancelled**
Policy terminated before its planned end date. Coverage stopped early.

**Expired**
Policy reached its natural end date. Coverage ended normally.

**Lapsed**
Policy became inactive due to non-payment or failure to renew.

---

## Policy Transactions (Version-creating events)

**Create**
Initial creation of a new policy.

**Quote**
Generate premium and coverage offer.

**Bind**
Convert accepted quote into a legally binding policy.

**Change (Endorsement)**
Modify coverage, risk, or contract. Creates new policy version.

**Cancel**
Terminate policy before expiration.

**Renew**
Start a new coverage term after expiration.

**Reinstate**
Restore a cancelled or lapsed policy.

All policies must have a state at all times.
