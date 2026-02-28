import {
  assertCoverageTermValueShape,
  assertDateOrder,
  assertDraftTransactionCommittable,
  assertDraftTransactionEditable,
} from "../../../domain/policy/invariants.js";
import { PolicyDomainError } from "../../../domain/policy/errors.js";
import type {
  CoverageTermValueType,
  DomainEventPublisher,
  JsonObject,
  PolicyBillingGateway,
  PolicyPricingGateway,
  PolicyRepository,
  PolicyRiskType,
  PolicyTransactionType,
} from "../ports/policy.js";
import { PolicyApplicationError } from "./errors.js";

const toEventData = (value: unknown): Record<string, unknown> =>
  structuredClone(value) as Record<string, unknown>;

const coverageRefKey = (coverageCode: string, appliesToRiskKey: string | null): string =>
  `${coverageCode}::${appliesToRiskKey ?? ""}`;

const moneyPattern = /^-?\d+(\.\d{1,2})?$/;

const moneyToMinor = (amount: string): bigint => {
  if (!moneyPattern.test(amount)) {
    throw new PolicyApplicationError("INVALID_MONEY_AMOUNT", "Invalid money amount format", 400);
  }
  const negative = amount.startsWith("-");
  const raw = negative ? amount.slice(1) : amount;
  const [wholePart, fraction = ""] = raw.split(".");
  const minor = BigInt(wholePart ?? "0") * 100n + BigInt(`${fraction}00`.slice(0, 2));
  return negative ? -minor : minor;
};

const minorToMoney = (value: bigint): string => {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${negative ? "-" : ""}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
};

export class PolicyService {
  public constructor(
    private readonly repository: PolicyRepository,
    private readonly pricingGateway: PolicyPricingGateway,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly billingGateway?: PolicyBillingGateway,
  ) {}

  public async createPolicy(input: {
    policyNumber: string;
    productId: string;
    productVersionId: string;
    termStart: Date;
    termEnd: Date;
    idempotencyKey: string;
  }): Promise<{
    id: string;
    policyNumber: string;
    status: string;
    productId: string;
    productVersionId: string;
    termId: string;
    termStart: string;
    termEnd: string;
    createdAt: string;
  }> {
    assertDateOrder(input.termStart, input.termEnd, "term");

    const scope = "POST /v1/policies";
    const existing = await this.repository.getIdempotency(scope, input.idempotencyKey);
    if (existing) {
      return existing as unknown as ReturnType<PolicyService["createPolicy"]> extends Promise<infer T>
        ? T
        : never;
    }

    const policy = await this.repository.createPolicy({
      policyNumber: input.policyNumber,
      productId: input.productId,
      productVersionId: input.productVersionId,
    });
    const term = await this.repository.createPolicyTerm({
      policyId: policy.id,
      termStart: input.termStart,
      termEnd: input.termEnd,
      status: "DRAFT",
    });

    const dto = {
      id: policy.id,
      policyNumber: policy.policyNumber,
      status: policy.status,
      productId: policy.productId,
      productVersionId: policy.productVersionId,
      termId: term.id,
      termStart: term.termStart.toISOString(),
      termEnd: term.termEnd.toISOString(),
      createdAt: policy.createdAt.toISOString(),
    };

    await this.repository.saveIdempotency({
      policyId: policy.id,
      scope,
      key: input.idempotencyKey,
      responseJson: dto as unknown as JsonObject,
    });

    await this.eventPublisher.publish({
      eventType: "PolicyCreated",
      entityType: "Policy",
      entityId: policy.id,
      data: toEventData(dto),
    });

    return dto;
  }

  public async listPolicies(query?: string): Promise<
    ReadonlyArray<{
      id: string;
      policyNumber: string;
      status: string;
      productId: string;
      productVersionId: string;
      createdAt: string;
    }>
  > {
    const rows = await this.repository.listPolicies(query);
    return rows.map((row) => ({
      id: row.id,
      policyNumber: row.policyNumber,
      status: row.status,
      productId: row.productId,
      productVersionId: row.productVersionId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  public async getPolicy(policyId: string): Promise<{
    id: string;
    policyNumber: string;
    status: string;
    productId: string;
    productVersionId: string;
    createdAt: string;
    updatedAt: string;
  }> {
    const policy = await this.repository.getPolicyById(policyId);
    if (!policy) {
      throw new PolicyApplicationError("POLICY_NOT_FOUND", "Policy not found", 404);
    }

    return {
      id: policy.id,
      policyNumber: policy.policyNumber,
      status: policy.status,
      productId: policy.productId,
      productVersionId: policy.productVersionId,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    };
  }

  public async createTransaction(input: {
    policyId: string;
    type: PolicyTransactionType;
    effectiveAt: Date;
    requestId: string | null;
    idempotencyKey: string;
  }): Promise<{
    id: string;
    policyId: string;
    termId: string;
    type: PolicyTransactionType;
    status: string;
    effectiveAt: string;
    createdAt: string;
  }> {
    const scope = `POST /v1/policies/${input.policyId}/transactions/${
      input.type === "NEW_BUSINESS" ? "new-business" : "endorsement"
    }`;
    const existing = await this.repository.getIdempotency(scope, input.idempotencyKey);
    if (existing) {
      return existing as unknown as ReturnType<PolicyService["createTransaction"]> extends Promise<infer T>
        ? T
        : never;
    }

    const policy = await this.repository.getPolicyById(input.policyId);
    if (!policy) {
      throw new PolicyApplicationError("POLICY_NOT_FOUND", "Policy not found", 404);
    }
    const term = await this.repository.getLatestPolicyTerm(input.policyId);
    if (!term) {
      throw new PolicyApplicationError("TERM_NOT_FOUND", "Policy term not found", 404);
    }

    if (input.type === "ENDORSEMENT") {
      if (policy.status !== "ACTIVE") {
        throw new PolicyApplicationError(
          "POLICY_NOT_ACTIVE",
          "Endorsement requires an ACTIVE policy",
          400,
        );
      }
      if (input.effectiveAt <= term.termStart || input.effectiveAt >= term.termEnd) {
        throw new PolicyApplicationError(
          "INVALID_ENDORSEMENT_EFFECTIVE_AT",
          "Endorsement effectiveAt must be within term bounds",
          400,
        );
      }
    }

    const tx = await this.repository.createPolicyTransaction({
      policyId: policy.id,
      termId: term.id,
      type: input.type,
      effectiveAt: input.effectiveAt,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
    });

    const dto = {
      id: tx.id,
      policyId: tx.policyId,
      termId: tx.termId,
      type: tx.type,
      status: tx.status,
      effectiveAt: tx.effectiveAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
    };

    await this.repository.saveIdempotency({
      policyId: policy.id,
      scope,
      key: input.idempotencyKey,
      responseJson: dto as unknown as JsonObject,
    });

    await this.eventPublisher.publish({
      eventType: "PolicyTransactionCreated",
      entityType: "PolicyTransaction",
      entityId: tx.id,
      data: toEventData(dto),
    });

    return dto;
  }

  public async listTransactions(policyId: string): Promise<
    ReadonlyArray<{
      id: string;
      policyId: string;
      termId: string;
      type: PolicyTransactionType;
      status: string;
      effectiveAt: string;
      createdAt: string;
      committedAt: string | null;
    }>
  > {
    const rows = await this.repository.listPolicyTransactions(policyId);
    return rows.map((row) => ({
      id: row.id,
      policyId: row.policyId,
      termId: row.termId,
      type: row.type,
      status: row.status,
      effectiveAt: row.effectiveAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      committedAt: row.committedAt ? row.committedAt.toISOString() : null,
    }));
  }

  public async getTransaction(transactionId: string): Promise<{
    id: string;
    policyId: string;
    termId: string;
    type: PolicyTransactionType;
    status: string;
    effectiveAt: string;
    createdAt: string;
    committedAt: string | null;
  }> {
    const tx = await this.repository.getPolicyTransactionById(transactionId);
    if (!tx) {
      throw new PolicyApplicationError("TRANSACTION_NOT_FOUND", "Policy transaction not found", 404);
    }
    return {
      id: tx.id,
      policyId: tx.policyId,
      termId: tx.termId,
      type: tx.type,
      status: tx.status,
      effectiveAt: tx.effectiveAt.toISOString(),
      createdAt: tx.createdAt.toISOString(),
      committedAt: tx.committedAt ? tx.committedAt.toISOString() : null,
    };
  }

  public async replaceTransactionRisks(input: {
    transactionId: string;
    risks: ReadonlyArray<{
      riskType: PolicyRiskType;
      riskKey: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<void> {
    const tx = await this.repository.getPolicyTransactionById(input.transactionId);
    if (!tx) {
      throw new PolicyApplicationError("TRANSACTION_NOT_FOUND", "Policy transaction not found", 404);
    }
    assertDraftTransactionCommittable(tx.status);

    const seenRiskKeys = new Set<string>();
    for (const risk of input.risks) {
      if (risk.riskKey) {
        if (seenRiskKeys.has(risk.riskKey)) {
          throw new PolicyApplicationError("DUPLICATE_RISK_KEY", "riskKey must be unique within transaction");
        }
        seenRiskKeys.add(risk.riskKey);
      }
    }

    await this.repository.replaceRiskDrafts({
      policyId: tx.policyId,
      transactionId: tx.id,
      risks: input.risks,
    });
  }

  public async replaceTransactionCoverages(input: {
    transactionId: string;
    coverages: ReadonlyArray<{
      coverageCode: string;
      appliesToRiskKey: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<void> {
    const tx = await this.requireDraftTransaction(input.transactionId);
    const riskDrafts = await this.repository.listRiskDrafts(tx.id);
    const riskKeys = new Set(riskDrafts.map((item) => item.riskKey).filter((item): item is string => item !== null));

    for (const coverage of input.coverages) {
      if (coverage.appliesToRiskKey && !riskKeys.has(coverage.appliesToRiskKey)) {
        throw new PolicyApplicationError(
          "RISK_KEY_NOT_FOUND",
          `Coverage references unknown riskKey ${coverage.appliesToRiskKey}`,
          400,
        );
      }
    }

    await this.repository.replaceCoverageDrafts({
      policyId: tx.policyId,
      transactionId: tx.id,
      coverages: input.coverages,
    });
  }

  public async replaceTransactionCoverageTerms(input: {
    transactionId: string;
    terms: ReadonlyArray<{
      coverageCode: string;
      appliesToRiskKey: string | null;
      termCode: string;
      valueType: CoverageTermValueType;
      moneyAmount: string | null;
      moneyCurrency: string | null;
      numberValue: string | null;
      stringValue: string | null;
      booleanValue: boolean | null;
    }>;
  }): Promise<void> {
    const tx = await this.requireDraftTransaction(input.transactionId);
    const coverages = await this.repository.listCoverageDrafts(tx.id);
    const coverageKeys = new Set(
      coverages.map((item) => coverageRefKey(item.coverageCode, item.appliesToRiskKey)),
    );

    for (const term of input.terms) {
      assertCoverageTermValueShape(term);
      const ref = coverageRefKey(term.coverageCode, term.appliesToRiskKey);
      if (!coverageKeys.has(ref)) {
        throw new PolicyApplicationError(
          "COVERAGE_REFERENCE_NOT_FOUND",
          `Coverage term references unknown coverage ${term.coverageCode}`,
          400,
        );
      }
    }

    await this.repository.replaceCoverageTermDrafts({
      policyId: tx.policyId,
      transactionId: tx.id,
      terms: input.terms,
    });
  }

  public async validateTransaction(transactionId: string): Promise<{
    transactionId: string;
    valid: boolean;
    issues: ReadonlyArray<string>;
  }> {
    const tx = await this.requireDraftTransaction(transactionId);
    const issues: string[] = [];

    const risks = await this.repository.listRiskDrafts(tx.id);
    const coverages = await this.repository.listCoverageDrafts(tx.id);
    const terms = await this.repository.listCoverageTermDrafts(tx.id);

    if (risks.length === 0) {
      issues.push("At least one risk is required");
    }
    if (coverages.length === 0) {
      issues.push("At least one coverage is required");
    }

    const riskKeySet = new Set(risks.map((item) => item.riskKey).filter((item): item is string => item !== null));
    for (const coverage of coverages) {
      if (coverage.appliesToRiskKey && !riskKeySet.has(coverage.appliesToRiskKey)) {
        issues.push(`Coverage ${coverage.coverageCode} references missing riskKey ${coverage.appliesToRiskKey}`);
      }
    }

    const coverageSet = new Set(coverages.map((item) => coverageRefKey(item.coverageCode, item.appliesToRiskKey)));
    for (const term of terms) {
      const match = coverages.find((item) => item.id === term.policyCoverageDraftId);
      if (!match || !coverageSet.has(coverageRefKey(match.coverageCode, match.appliesToRiskKey))) {
        issues.push(`Coverage term ${term.termCode} references missing draft coverage`);
      }
    }

    return {
      transactionId,
      valid: issues.length === 0,
      issues,
    };
  }

  public async rateTransaction(input: {
    transactionId: string;
    requestId: string;
    currency?: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
  }): Promise<{
    transactionId: string;
    requestId: string;
    totalPremium: string;
    currency: string;
  }> {
    const tx = await this.requireDraftTransaction(input.transactionId);
    const policy = await this.repository.getPolicyById(tx.policyId);
    if (!policy) {
      throw new PolicyApplicationError("POLICY_NOT_FOUND", "Policy not found", 404);
    }

    const result = await this.pricingGateway.calculate({
      requestId: input.requestId,
      productVersionId: policy.productVersionId,
      policyTransactionId: tx.id,
      ...(input.currency ? { currency: input.currency } : {}),
    });

    await this.repository.setPolicyTransactionRating({
      transactionId: tx.id,
      ratingRequestJson: {
        requestId: result.requestId,
      },
      ratingResponseJson: result.response as unknown as JsonObject,
      ratedAt: new Date(),
    });

    await this.eventPublisher.publish({
      eventType: "PolicyTransactionRated",
      entityType: "PolicyTransaction",
      entityId: tx.id,
      data: toEventData({
        policyId: tx.policyId,
        transactionId: tx.id,
        requestId: result.requestId,
        totalPremium: result.response.totals.totalPremium,
        currency: result.response.totals.currency,
      }),
    });

    return {
      transactionId: tx.id,
      requestId: result.requestId,
      totalPremium: result.response.totals.totalPremium,
      currency: result.response.totals.currency,
    };
  }

  public async commitTransaction(input: {
    transactionId: string;
    idempotencyKey: string;
  }): Promise<{ policyId: string; transactionId: string; committedAt: string }> {
    const scope = `POST /v1/policy-transactions/${input.transactionId}/commit`;
    const existing = await this.repository.getIdempotency(scope, input.idempotencyKey);
    if (existing) {
      return existing as unknown as ReturnType<PolicyService["commitTransaction"]> extends Promise<infer T>
        ? T
        : never;
    }

    const tx = await this.requireDraftTransaction(input.transactionId);
    const policy = await this.repository.getPolicyById(tx.policyId);
    if (!policy) {
      throw new PolicyApplicationError("POLICY_NOT_FOUND", "Policy not found", 404);
    }
    const term = await this.repository.getPolicyTermById(tx.termId);
    if (!term) {
      throw new PolicyApplicationError("TERM_NOT_FOUND", "Policy term not found", 404);
    }

    if (tx.effectiveAt < term.termStart || tx.effectiveAt >= term.termEnd) {
      throw new PolicyApplicationError(
        "EFFECTIVE_AT_OUTSIDE_TERM",
        "Transaction effectiveAt must be within term bounds",
        400,
      );
    }

    const validation = await this.validateTransaction(tx.id);
    if (!validation.valid) {
      throw new PolicyApplicationError(
        "TRANSACTION_INVALID",
        `Transaction validation failed: ${validation.issues.join("; ")}`,
        400,
      );
    }

    const priorPremiums = await this.repository.getAsOfPremiums(
      policy.id,
      new Date(tx.effectiveAt.getTime() - 1),
    );
    let priorPremiumCurrency: string | null = null;
    let priorPremiumTotalMinor = 0n;
    for (const premium of priorPremiums) {
      if (priorPremiumCurrency && priorPremiumCurrency !== premium.currency) {
        throw new PolicyApplicationError(
          "MULTI_CURRENCY_POLICY_PREMIUM_NOT_SUPPORTED",
          "Premium delta calculation requires a single premium currency",
          400,
        );
      }
      priorPremiumCurrency = premium.currency;
      priorPremiumTotalMinor += moneyToMinor(premium.totalAmount);
    }

    const riskDrafts = await this.repository.listRiskDrafts(tx.id);
    const coverageDrafts = await this.repository.listCoverageDrafts(tx.id);
    const termDrafts = await this.repository.listCoverageTermDrafts(tx.id);

    await this.repository.closeActiveCoverageTerms(policy.id, tx.effectiveAt);
    await this.repository.closeActiveCoverages(policy.id, tx.effectiveAt);
    await this.repository.closeActiveRisks(policy.id, tx.effectiveAt);
    await this.repository.closeActivePremiums(policy.id, tx.effectiveAt);

    const createdRisks = await this.repository.createPolicyRisks({
      policyId: policy.id,
      termId: term.id,
      createdByTransactionId: tx.id,
      effectiveFrom: tx.effectiveAt,
      effectiveTo: term.termEnd,
      risks: riskDrafts.map((risk) => ({
        riskType: risk.riskType,
        riskKey: risk.riskKey,
        attributes: risk.attributes,
      })),
    });

    const riskIdByKey = new Map<string, string>();
    for (const risk of createdRisks) {
      if (risk.riskKey) {
        riskIdByKey.set(risk.riskKey, risk.id);
      }
    }

    const createdCoverages = await this.repository.createPolicyCoverages({
      policyId: policy.id,
      termId: term.id,
      createdByTransactionId: tx.id,
      effectiveFrom: tx.effectiveAt,
      effectiveTo: term.termEnd,
      coverages: coverageDrafts.map((coverage) => ({
        coverageCode: coverage.coverageCode,
        appliesToRiskId: coverage.appliesToRiskKey ? riskIdByKey.get(coverage.appliesToRiskKey) ?? null : null,
        attributes: coverage.attributes,
      })),
    });

    const coverageByRef = new Map<string, string>();
    for (let index = 0; index < createdCoverages.length; index += 1) {
      const created = createdCoverages[index];
      const draft = coverageDrafts[index];
      if (!created || !draft) {
        continue;
      }
      coverageByRef.set(coverageRefKey(draft.coverageCode, draft.appliesToRiskKey), created.id);
    }

    await this.repository.createCoverageTerms({
      createdByTransactionId: tx.id,
      effectiveFrom: tx.effectiveAt,
      effectiveTo: term.termEnd,
      terms: termDrafts.map((termDraft) => {
        const draftCoverage = coverageDrafts.find((coverage) => coverage.id === termDraft.policyCoverageDraftId);
        if (!draftCoverage) {
          throw new PolicyApplicationError(
            "COVERAGE_REFERENCE_NOT_FOUND",
            `Coverage term ${termDraft.termCode} references missing draft coverage`,
            400,
          );
        }
        const policyCoverageId = coverageByRef.get(
          coverageRefKey(draftCoverage.coverageCode, draftCoverage.appliesToRiskKey),
        );
        if (!policyCoverageId) {
          throw new PolicyApplicationError(
            "COVERAGE_REFERENCE_NOT_FOUND",
            `Coverage term ${termDraft.termCode} references missing committed coverage`,
            400,
          );
        }
        return {
          policyCoverageId,
          termCode: termDraft.termCode,
          valueType: termDraft.valueType,
          moneyAmount: termDraft.moneyAmount,
          moneyCurrency: termDraft.moneyCurrency,
          numberValue: termDraft.numberValue,
          stringValue: termDraft.stringValue,
          booleanValue: termDraft.booleanValue,
        };
      }),
    });

    let committedPremiumCurrency: string | null = null;
    let committedPremiumTotalMinor = 0n;
    if (tx.ratingResponseJson) {
      const rating = tx.ratingResponseJson as {
        totals?: { totalPremium?: string; currency?: string };
      };
      const totalPremium = rating.totals?.totalPremium;
      const currency = rating.totals?.currency;
      if (totalPremium && currency) {
        committedPremiumCurrency = currency;
        committedPremiumTotalMinor = moneyToMinor(totalPremium);
        await this.repository.createPolicyPremiums({
          policyId: policy.id,
          termId: term.id,
          createdByTransactionId: tx.id,
          effectiveFrom: tx.effectiveAt,
          effectiveTo: term.termEnd,
          premiums: [
            {
              coverageId: null,
              riskId: null,
              totalAmount: totalPremium,
              currency,
              breakdown: tx.ratingResponseJson,
            },
          ],
        });
      }
    }

    const committed = await this.repository.commitPolicyTransaction(tx.id, new Date());
    await this.repository.updatePolicyStatus(policy.id, "ACTIVE");
    await this.repository.updatePolicyTermStatus(term.id, "ACTIVE");

    if (this.billingGateway && committedPremiumCurrency) {
      if (priorPremiumCurrency && priorPremiumCurrency !== committedPremiumCurrency) {
        throw new PolicyApplicationError(
          "PREMIUM_CURRENCY_MISMATCH",
          "Premium currency mismatch between prior and committed premiums",
          400,
        );
      }

      const obligationDeltaMinor = committedPremiumTotalMinor - priorPremiumTotalMinor;
      if (obligationDeltaMinor !== 0n) {
        await this.billingGateway.createObligationFromPremiumDelta({
          policyId: policy.id,
          policyTransactionId: tx.id,
          termId: term.id,
          amount: minorToMoney(obligationDeltaMinor),
          currency: committedPremiumCurrency as "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK",
          dueDate: tx.effectiveAt,
        });
      }
    }

    const dto = {
      policyId: committed.policyId,
      transactionId: committed.id,
      committedAt: (committed.committedAt ?? new Date()).toISOString(),
    };

    await this.repository.saveIdempotency({
      policyId: committed.policyId,
      scope,
      key: input.idempotencyKey,
      responseJson: dto as unknown as JsonObject,
    });

    await this.eventPublisher.publish({
      eventType: "PolicyTransactionCommitted",
      entityType: "PolicyTransaction",
      entityId: committed.id,
      data: toEventData(dto),
    });

    const snapshot = await this.getPolicySnapshot(policy.id, tx.effectiveAt);
    await this.eventPublisher.publish({
      eventType: "PolicySnapshotChanged",
      entityType: "Policy",
      entityId: policy.id,
      data: toEventData(snapshot),
    });

    return dto;
  }

  public async getPolicySnapshot(policyId: string, asOf: Date, includeFinancials = false): Promise<{
    policy: {
      id: string;
      policyNumber: string;
      status: string;
      productId: string;
      productVersionId: string;
    };
    term: {
      id: string;
      termStart: string;
      termEnd: string;
      status: string;
    } | null;
    asOf: string;
    risks: ReadonlyArray<{
      id: string;
      riskType: PolicyRiskType;
      riskKey: string | null;
      attributes: JsonObject;
      effectiveFrom: string;
      effectiveTo: string;
    }>;
    coverages: ReadonlyArray<{
      id: string;
      coverageCode: string;
      appliesToRiskId: string | null;
      attributes: JsonObject;
      effectiveFrom: string;
      effectiveTo: string;
      terms: ReadonlyArray<{
        id: string;
        termCode: string;
        valueType: CoverageTermValueType;
        moneyAmount: string | null;
        moneyCurrency: string | null;
        numberValue: string | null;
        stringValue: string | null;
        booleanValue: boolean | null;
        effectiveFrom: string;
        effectiveTo: string;
      }>;
    }>;
    premiums: ReadonlyArray<{
      id: string;
      coverageId: string | null;
      riskId: string | null;
      totalAmount: string;
      currency: string;
      breakdown: JsonObject | null;
      effectiveFrom: string;
      effectiveTo: string;
    }>;
    financials: {
      policyId: string;
      asOf: string;
      outstandingObligations: ReadonlyArray<{
        id: string;
        policyTransactionId: string;
        termId: string;
        billingAccountId: string | null;
        amount: string;
        currency: string;
        dueDate: string;
        status: string;
      }>;
      linkedInvoices: ReadonlyArray<{
        obligationId: string;
        invoiceId: string;
        invoiceNumber: string;
        status: string;
        invoiceTotal: string;
        amountPaid: string;
      }>;
      paidAmount: string;
    } | null;
  }> {
    const policy = await this.repository.getPolicyById(policyId);
    if (!policy) {
      throw new PolicyApplicationError("POLICY_NOT_FOUND", "Policy not found", 404);
    }

    const term = await this.repository.getLatestPolicyTerm(policy.id);
    const risks = await this.repository.getAsOfRisks(policy.id, asOf);
    const coverages = await this.repository.getAsOfCoverages(policy.id, asOf);
    const coverageTerms = await this.repository.getAsOfCoverageTermsByCoverageIds(
      coverages.map((coverage) => coverage.id),
      asOf,
    );
    const premiums = await this.repository.getAsOfPremiums(policy.id, asOf);
    const financials = includeFinancials && this.billingGateway
      ? await this.billingGateway.getFinancialPosition({ policyId: policy.id, asOf })
      : null;

    return {
      policy: {
        id: policy.id,
        policyNumber: policy.policyNumber,
        status: policy.status,
        productId: policy.productId,
        productVersionId: policy.productVersionId,
      },
      term: term
        ? {
            id: term.id,
            termStart: term.termStart.toISOString(),
            termEnd: term.termEnd.toISOString(),
            status: term.status,
          }
        : null,
      asOf: asOf.toISOString(),
      risks: risks.map((risk) => ({
        id: risk.id,
        riskType: risk.riskType,
        riskKey: risk.riskKey,
        attributes: risk.attributes,
        effectiveFrom: risk.effectiveFrom.toISOString(),
        effectiveTo: risk.effectiveTo.toISOString(),
      })),
      coverages: coverages.map((coverage) => ({
        id: coverage.id,
        coverageCode: coverage.coverageCode,
        appliesToRiskId: coverage.appliesToRiskId,
        attributes: coverage.attributes,
        effectiveFrom: coverage.effectiveFrom.toISOString(),
        effectiveTo: coverage.effectiveTo.toISOString(),
        terms: coverageTerms
          .filter((termItem) => termItem.policyCoverageId === coverage.id)
          .map((termItem) => ({
            id: termItem.id,
            termCode: termItem.termCode,
            valueType: termItem.valueType,
            moneyAmount: termItem.moneyAmount,
            moneyCurrency: termItem.moneyCurrency,
            numberValue: termItem.numberValue,
            stringValue: termItem.stringValue,
            booleanValue: termItem.booleanValue,
            effectiveFrom: termItem.effectiveFrom.toISOString(),
            effectiveTo: termItem.effectiveTo.toISOString(),
          })),
      })),
      premiums: premiums.map((premium) => ({
        id: premium.id,
        coverageId: premium.coverageId,
        riskId: premium.riskId,
        totalAmount: premium.totalAmount,
        currency: premium.currency,
        breakdown: premium.breakdown,
        effectiveFrom: premium.effectiveFrom.toISOString(),
        effectiveTo: premium.effectiveTo.toISOString(),
      })),
      financials,
    };
  }

  private async requireDraftTransaction(transactionId: string) {
    const tx = await this.repository.getPolicyTransactionById(transactionId);
    if (!tx) {
      throw new PolicyApplicationError("TRANSACTION_NOT_FOUND", "Policy transaction not found", 404);
    }
    assertDraftTransactionEditable(tx.status);
    return tx;
  }
}

export const mapPolicyError = (error: unknown): PolicyApplicationError => {
  if (error instanceof PolicyApplicationError) {
    return error;
  }
  if (error instanceof PolicyDomainError) {
    return new PolicyApplicationError("POLICY_DOMAIN_ERROR", error.message, 400);
  }
  return new PolicyApplicationError("INTERNAL_POLICY_ERROR", "Internal policy error", 500);
};
