import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { BillingDomainError } from "../../../domain/billing/errors.js";
import { BillingService } from "./billing-service.js";
import type {
  BillingAccountRecord,
  BillingObligationRecord,
  BillingRepository,
  DomainEventPublisher,
  InvoiceLineRecord,
  InvoiceRecord,
  JsonObject,
  PaymentAllocationRecord,
  PaymentRecord,
} from "../ports/billing.js";

class InMemoryDomainEventPublisher implements DomainEventPublisher {
  public readonly events: Array<{ eventType: string; entityId: string; data: JsonObject }> = [];

  public async publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    this.events.push({
      eventType: input.eventType,
      entityId: input.entityId,
      data: input.data as JsonObject,
    });
  }
}

class InMemoryBillingRepository implements BillingRepository {
  public readonly invoices = new Map<string, InvoiceRecord>();
  private readonly billingAccounts = new Map<string, BillingAccountRecord>();
  private readonly invoiceLines = new Map<string, InvoiceLineRecord>();
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly paymentAllocations = new Map<string, PaymentAllocationRecord>();
  private readonly obligations = new Map<string, BillingObligationRecord>();
  private readonly idempotency = new Map<string, JsonObject>();
  private invoiceSequence = 0;

  public async createBillingAccount(input: { partyId: string }): Promise<BillingAccountRecord> {
    const now = new Date();
    const row: BillingAccountRecord = {
      id: randomUUID(),
      partyId: input.partyId,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    this.billingAccounts.set(row.id, row);
    return row;
  }

  public async listBillingAccounts(query?: string): Promise<ReadonlyArray<BillingAccountRecord>> {
    const rows = [...this.billingAccounts.values()];
    if (!query) {
      return rows;
    }
    return rows.filter((row) => row.id.includes(query) || row.partyId.includes(query));
  }

  public async getBillingAccountById(accountId: string): Promise<BillingAccountRecord | null> {
    return this.billingAccounts.get(accountId) ?? null;
  }

  public async getNextInvoiceNumber(): Promise<string> {
    this.invoiceSequence += 1;
    return `INV-${String(this.invoiceSequence).padStart(6, "0")}`;
  }

  public async createInvoiceWithLines(input: {
    billingAccountId: string;
    invoiceNumber: string;
    currency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    dueDate: Date;
    totalAmount: string;
    lines: ReadonlyArray<{
      description: string;
      quantity: string;
      unitAmount: string;
      lineTotal: string;
      billingObligationId?: string | null;
    }>;
  }): Promise<{ invoice: InvoiceRecord; lines: ReadonlyArray<InvoiceLineRecord> }> {
    const now = new Date();
    const invoice: InvoiceRecord = {
      id: randomUUID(),
      billingAccountId: input.billingAccountId,
      invoiceNumber: input.invoiceNumber,
      status: "POSTED",
      currency: input.currency,
      dueDate: input.dueDate,
      totalAmount: input.totalAmount,
      postedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.invoices.set(invoice.id, invoice);

    const lines = input.lines.map((line) => {
      const row: InvoiceLineRecord = {
        id: randomUUID(),
        invoiceId: invoice.id,
        billingObligationId: line.billingObligationId ?? null,
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        lineTotal: line.lineTotal,
        createdAt: now,
      };
      this.invoiceLines.set(row.id, row);
      return row;
    });

    return { invoice, lines };
  }

  public async listInvoicesByAccount(accountId: string): Promise<ReadonlyArray<InvoiceRecord>> {
    return [...this.invoices.values()].filter((row) => row.billingAccountId === accountId);
  }

  public async getInvoiceById(invoiceId: string): Promise<InvoiceRecord | null> {
    return this.invoices.get(invoiceId) ?? null;
  }

  public async listInvoiceLines(invoiceId: string): Promise<ReadonlyArray<InvoiceLineRecord>> {
    return [...this.invoiceLines.values()].filter((row) => row.invoiceId === invoiceId);
  }

  public async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceRecord["status"],
  ): Promise<InvoiceRecord> {
    const current = this.invoices.get(invoiceId);
    if (!current) {
      throw new Error("invoice not found");
    }
    const updated: InvoiceRecord = { ...current, status, updatedAt: new Date() };
    this.invoices.set(updated.id, updated);
    return updated;
  }

  public async createPayment(input: {
    billingAccountId: string;
    amount: string;
    currency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    providerRef: string | null;
  }): Promise<PaymentRecord> {
    const now = new Date();
    const row: PaymentRecord = {
      id: randomUUID(),
      billingAccountId: input.billingAccountId,
      amount: input.amount,
      currency: input.currency,
      status: "RECEIVED",
      providerRef: input.providerRef,
      createdAt: now,
      updatedAt: now,
    };
    this.payments.set(row.id, row);
    return row;
  }

  public async listPaymentsByAccount(accountId: string): Promise<ReadonlyArray<PaymentRecord>> {
    return [...this.payments.values()].filter((row) => row.billingAccountId === accountId);
  }

  public async getPaymentById(paymentId: string): Promise<PaymentRecord | null> {
    return this.payments.get(paymentId) ?? null;
  }

  public async updatePaymentStatus(
    paymentId: string,
    status: PaymentRecord["status"],
  ): Promise<PaymentRecord> {
    const current = this.payments.get(paymentId);
    if (!current) {
      throw new Error("payment not found");
    }
    const updated: PaymentRecord = { ...current, status, updatedAt: new Date() };
    this.payments.set(updated.id, updated);
    return updated;
  }

  public async createPaymentAllocation(input: {
    paymentId: string;
    invoiceId: string;
    amount: string;
  }): Promise<PaymentAllocationRecord> {
    const duplicate = [...this.paymentAllocations.values()].find(
      (row) => row.paymentId === input.paymentId && row.invoiceId === input.invoiceId,
    );
    if (duplicate) {
      throw new Error("duplicate allocation");
    }

    const row: PaymentAllocationRecord = {
      id: randomUUID(),
      paymentId: input.paymentId,
      invoiceId: input.invoiceId,
      amount: input.amount,
      createdAt: new Date(),
    };
    this.paymentAllocations.set(row.id, row);
    return row;
  }

  public async listPaymentAllocationsByPayment(
    paymentId: string,
  ): Promise<ReadonlyArray<PaymentAllocationRecord>> {
    return [...this.paymentAllocations.values()].filter((row) => row.paymentId === paymentId);
  }

  public async listPaymentAllocationsByInvoice(
    invoiceId: string,
  ): Promise<ReadonlyArray<PaymentAllocationRecord>> {
    return [...this.paymentAllocations.values()].filter((row) => row.invoiceId === invoiceId);
  }

  public async createBillingObligation(input: {
    policyId: string;
    policyTransactionId: string;
    termId: string;
    billingAccountId: string | null;
    amount: string;
    currency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    dueDate: Date;
  }): Promise<BillingObligationRecord> {
    const row: BillingObligationRecord = {
      id: randomUUID(),
      policyId: input.policyId,
      policyTransactionId: input.policyTransactionId,
      termId: input.termId,
      billingAccountId: input.billingAccountId,
      amount: input.amount,
      currency: input.currency,
      dueDate: input.dueDate,
      status: "OPEN",
      createdAt: new Date(),
    };
    this.obligations.set(row.id, row);
    return row;
  }

  public async getBillingObligationById(obligationId: string): Promise<BillingObligationRecord | null> {
    return this.obligations.get(obligationId) ?? null;
  }

  public async updateBillingObligation(input: {
    obligationId: string;
    status?: BillingObligationRecord["status"];
    billingAccountId?: string | null;
  }): Promise<BillingObligationRecord> {
    const row = this.obligations.get(input.obligationId);
    if (!row) {
      throw new Error("obligation not found");
    }
    const updated: BillingObligationRecord = {
      ...row,
      ...(input.status ? { status: input.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "billingAccountId")
        ? { billingAccountId: input.billingAccountId ?? null }
        : {}),
    };
    this.obligations.set(updated.id, updated);
    return updated;
  }

  public async listBillingObligationsByPolicy(
    policyId: string,
    asOf: Date,
  ): Promise<
    ReadonlyArray<
      BillingObligationRecord & {
        invoices: ReadonlyArray<{
          invoiceId: string;
          invoiceNumber: string;
          invoiceStatus: InvoiceRecord["status"];
          invoiceTotal: string;
          amountPaid: string;
        }>;
      }
    >
  > {
    const obligations = [...this.obligations.values()].filter(
      (row) => row.policyId === policyId && row.createdAt <= asOf,
    );
    return obligations.map((obligation) => {
      const obligationLines = [...this.invoiceLines.values()].filter(
        (line) => line.billingObligationId === obligation.id,
      );
      const invoices = obligationLines
        .map((line) => this.invoices.get(line.invoiceId))
        .filter((invoice): invoice is InvoiceRecord => invoice !== undefined)
        .map((invoice) => ({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceStatus: invoice.status,
          invoiceTotal: invoice.totalAmount,
          amountPaid: [...this.paymentAllocations.values()]
            .filter((allocation) => allocation.invoiceId === invoice.id)
            .reduce((sum, allocation) => sum + Number.parseFloat(allocation.amount), 0)
            .toFixed(2),
        }));
      return { ...obligation, invoices };
    });
  }

  public async getIdempotency(scope: string, key: string): Promise<JsonObject | null> {
    return this.idempotency.get(`${scope}::${key}`) ?? null;
  }

  public async saveIdempotency(scope: string, key: string, responseJson: JsonObject): Promise<void> {
    this.idempotency.set(`${scope}::${key}`, structuredClone(responseJson) as JsonObject);
  }

  public async createAuditLog(input: {
    billingAccountId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    data: JsonObject;
  }): Promise<void> {
    void input;
  }
}

test("posting invoice creates correct totals and POSTED status", async () => {
  const repository = new InMemoryBillingRepository();
  const service = new BillingService(repository, new InMemoryDomainEventPublisher());
  const account = await service.createBillingAccount({ partyId: randomUUID() });

  const invoice = await service.createAndPostInvoice({
    accountId: account.id,
    currency: "SEK",
    dueDate: new Date("2026-03-01T00:00:00.000Z"),
    lines: [
      { description: "base premium", quantity: "1.00", unitAmount: "100.00" },
      { description: "fee", quantity: "2.00", unitAmount: "25.00" },
    ],
    idempotencyKey: "invoice-post-1",
  });

  assert.equal(invoice.status, "POSTED");
  assert.equal(invoice.invoiceTotal, "150.00");
  assert.equal(invoice.amountPaid, "0.00");
  assert.equal(invoice.amountDue, "150.00");
});

test("payment allocation prevents over-allocation and updates invoice statuses", async () => {
  const repository = new InMemoryBillingRepository();
  const service = new BillingService(repository, new InMemoryDomainEventPublisher());
  const account = await service.createBillingAccount({ partyId: randomUUID() });

  const invoiceA = await service.createAndPostInvoice({
    accountId: account.id,
    currency: "SEK",
    dueDate: new Date("2026-03-01T00:00:00.000Z"),
    lines: [{ description: "a", quantity: "1.00", unitAmount: "100.00" }],
    idempotencyKey: "invoice-a",
  });
  const invoiceB = await service.createAndPostInvoice({
    accountId: account.id,
    currency: "SEK",
    dueDate: new Date("2026-03-01T00:00:00.000Z"),
    lines: [{ description: "b", quantity: "1.00", unitAmount: "100.00" }],
    idempotencyKey: "invoice-b",
  });
  const payment = await service.recordPayment({
    accountId: account.id,
    amount: "150.00",
    currency: "SEK",
    providerRef: null,
    idempotencyKey: "payment-1",
  });

  const allocationResult = await service.allocatePayment({
    paymentId: payment.id,
    allocations: [
      { invoiceId: invoiceA.id, amount: "100.00" },
      { invoiceId: invoiceB.id, amount: "50.00" },
    ],
    idempotencyKey: "alloc-1",
  });

  assert.equal(allocationResult.paymentUnallocatedAmount, "0.00");
  assert.equal(repository.invoices.get(invoiceA.id)?.status, "PAID");
  assert.equal(repository.invoices.get(invoiceB.id)?.status, "PARTIALLY_PAID");

  await assert.rejects(
    () =>
      service.allocatePayment({
        paymentId: payment.id,
        allocations: [{ invoiceId: invoiceB.id, amount: "0.01" }],
        idempotencyKey: "alloc-over",
      }),
    (error: unknown) => {
      assert.ok(error instanceof BillingDomainError);
      assert.match(error.message, /over-allocation/i);
      return true;
    },
  );
});

test("idempotency key prevents duplicate invoice creation", async () => {
  const repository = new InMemoryBillingRepository();
  const service = new BillingService(repository, new InMemoryDomainEventPublisher());
  const account = await service.createBillingAccount({ partyId: randomUUID() });

  const first = await service.createAndPostInvoice({
    accountId: account.id,
    currency: "EUR",
    dueDate: new Date("2026-03-01T00:00:00.000Z"),
    lines: [{ description: "premium", quantity: "1.00", unitAmount: "90.00" }],
    idempotencyKey: "same-key",
  });
  const second = await service.createAndPostInvoice({
    accountId: account.id,
    currency: "EUR",
    dueDate: new Date("2026-03-01T00:00:00.000Z"),
    lines: [{ description: "premium", quantity: "1.00", unitAmount: "90.00" }],
    idempotencyKey: "same-key",
  });

  assert.equal(first.id, second.id);
  assert.equal(repository.invoices.size, 1);
});

test("invoice generation from obligation links invoice and updates obligation status", async () => {
  const repository = new InMemoryBillingRepository();
  const service = new BillingService(repository, new InMemoryDomainEventPublisher());
  const account = await service.createBillingAccount({ partyId: randomUUID() });
  const obligation = await service.createPolicyObligation({
    policyId: randomUUID(),
    policyTransactionId: randomUUID(),
    termId: randomUUID(),
    amount: "100.00",
    currency: "SEK",
    dueDate: new Date("2026-04-01T00:00:00.000Z"),
    billingAccountId: account.id,
  });

  const invoice = await service.generateInvoiceFromObligation({
    obligationId: obligation.id,
    dueDate: new Date("2026-04-05T00:00:00.000Z"),
    idempotencyKey: "obligation-invoice-1",
  });

  assert.equal(invoice.invoiceTotal, "100.00");
  assert.equal(repository.invoices.size, 1);
  assert.equal((await repository.getBillingObligationById(obligation.id))?.status, "INVOICED");
});

test("negative billing obligation can be invoiced as credit", async () => {
  const repository = new InMemoryBillingRepository();
  const service = new BillingService(repository, new InMemoryDomainEventPublisher());
  const account = await service.createBillingAccount({ partyId: randomUUID() });
  const obligation = await service.createPolicyObligation({
    policyId: randomUUID(),
    policyTransactionId: randomUUID(),
    termId: randomUUID(),
    amount: "-25.00",
    currency: "SEK",
    dueDate: new Date("2026-04-01T00:00:00.000Z"),
    billingAccountId: account.id,
  });

  const invoice = await service.generateInvoiceFromObligation({
    obligationId: obligation.id,
    dueDate: new Date("2026-04-05T00:00:00.000Z"),
    idempotencyKey: "obligation-invoice-negative-1",
  });

  assert.equal(invoice.invoiceTotal, "-25.00");
  assert.equal((await repository.getBillingObligationById(obligation.id))?.status, "INVOICED");
});
