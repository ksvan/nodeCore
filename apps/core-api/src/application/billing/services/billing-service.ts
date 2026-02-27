import {
  assertCurrencyMatch,
  assertNoOverAllocation,
  assertPositiveMoney,
  formatMinorUnitsToMoney,
  parseMoneyToMinorUnits,
  sumMoneyStrings,
} from "../../../domain/billing/index.js";
import type {
  BillingRepository,
  CurrencyCode,
  DomainEventPublisher,
  InvoiceRecord,
  JsonObject,
  PaymentRecord,
} from "../ports/billing.js";
import { BillingApplicationError } from "./errors.js";

interface InvoiceLineInput {
  description: string;
  quantity: string;
  unitAmount: string;
}

const toJsonRecord = (value: unknown): Record<string, unknown> =>
  structuredClone(value) as Record<string, unknown>;

const eventData = (value: unknown): Record<string, unknown> => toJsonRecord(value);

const computeInvoiceStatus = (totalAmount: string, amountPaid: string): InvoiceRecord["status"] => {
  const total = parseMoneyToMinorUnits(totalAmount);
  const paid = parseMoneyToMinorUnits(amountPaid);
  if (paid <= 0n) {
    return "POSTED";
  }
  if (paid < total) {
    return "PARTIALLY_PAID";
  }
  return "PAID";
};

const computePaymentStatus = (amount: string, allocatedAmount: string): PaymentRecord["status"] => {
  const total = parseMoneyToMinorUnits(amount);
  const allocated = parseMoneyToMinorUnits(allocatedAmount);
  return allocated >= total ? "ALLOCATED" : "RECEIVED";
};

export class BillingService {
  public constructor(
    private readonly repository: BillingRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  public async createBillingAccount(input: { partyId: string }): Promise<{
    id: string;
    partyId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }> {
    const created = await this.repository.createBillingAccount({ partyId: input.partyId });
    const dto = {
      id: created.id,
      partyId: created.partyId,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };

    await this.repository.createAuditLog({
      billingAccountId: created.id,
      entityType: "BillingAccount",
      entityId: created.id,
      action: "BillingAccountCreated",
      data: dto as JsonObject,
    });
    await this.eventPublisher.publish({
      eventType: "BillingAccountCreated",
      entityType: "BillingAccount",
      entityId: created.id,
      data: eventData(dto),
    });
    return dto;
  }

  public async listBillingAccounts(query?: string): Promise<
    ReadonlyArray<{ id: string; partyId: string; status: string; createdAt: string; updatedAt: string }>
  > {
    const rows = await this.repository.listBillingAccounts(query);
    return rows.map((row) => ({
      id: row.id,
      partyId: row.partyId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  public async getBillingAccount(accountId: string): Promise<{
    id: string;
    partyId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    accountBalance: string;
  }> {
    const account = await this.repository.getBillingAccountById(accountId);
    if (!account) {
      throw new BillingApplicationError("ACCOUNT_NOT_FOUND", "Billing account not found", 404);
    }

    const invoices = await this.repository.listInvoicesByAccount(accountId);
    const payments = await this.repository.listPaymentsByAccount(accountId);

    const openDueMinor = (
      await Promise.all(
        invoices.map(async (invoice) => {
          const allocations = await this.repository.listPaymentAllocationsByInvoice(invoice.id);
          const paid = allocations.reduce((acc, allocation) => acc + parseMoneyToMinorUnits(allocation.amount), 0n);
          const due = parseMoneyToMinorUnits(invoice.totalAmount) - paid;
          return due > 0n ? due : 0n;
        }),
      )
    ).reduce((acc, value) => acc + value, 0n);

    const unallocatedMinor = (
      await Promise.all(
        payments.map(async (payment) => {
          const allocations = await this.repository.listPaymentAllocationsByPayment(payment.id);
          const allocated = allocations.reduce(
            (acc, allocation) => acc + parseMoneyToMinorUnits(allocation.amount),
            0n,
          );
          const unallocated = parseMoneyToMinorUnits(payment.amount) - allocated;
          return unallocated > 0n ? unallocated : 0n;
        }),
      )
    ).reduce((acc, value) => acc + value, 0n);

    return {
      id: account.id,
      partyId: account.partyId,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      accountBalance: formatMinorUnitsToMoney(openDueMinor - unallocatedMinor),
    };
  }

  public async createAndPostInvoice(input: {
    accountId: string;
    currency: CurrencyCode;
    dueDate: Date;
    lines: ReadonlyArray<InvoiceLineInput>;
    idempotencyKey: string;
  }): Promise<{
    id: string;
    billingAccountId: string;
    invoiceNumber: string;
    currency: CurrencyCode;
    dueDate: string;
    postedAt: string;
    status: string;
    invoiceTotal: string;
    amountPaid: string;
    amountDue: string;
    lines: ReadonlyArray<{
      id: string;
      description: string;
      quantity: string;
      unitAmount: string;
      lineTotal: string;
    }>;
  }> {
    const scope = `POST /v1/billing/accounts/${input.accountId}/invoices`;
    const existing = await this.repository.getIdempotency(scope, input.idempotencyKey);
    if (existing) {
      return existing as unknown as ReturnType<BillingService["createAndPostInvoice"]> extends Promise<infer T>
        ? T
        : never;
    }

    const account = await this.repository.getBillingAccountById(input.accountId);
    if (!account) {
      throw new BillingApplicationError("ACCOUNT_NOT_FOUND", "Billing account not found", 404);
    }
    if (input.lines.length === 0) {
      throw new BillingApplicationError("INVOICE_LINES_REQUIRED", "Invoice must have at least one line");
    }

    const lines = input.lines.map((line) => {
      assertPositiveMoney(line.quantity, "quantity");
      assertPositiveMoney(line.unitAmount, "unitAmount");
      const quantityMinor = parseMoneyToMinorUnits(line.quantity);
      const unitMinor = parseMoneyToMinorUnits(line.unitAmount);
      const lineTotal = (quantityMinor * unitMinor) / 100n;
      return {
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        lineTotal: formatMinorUnitsToMoney(lineTotal),
      };
    });

    const totalAmount = sumMoneyStrings(lines.map((line) => line.lineTotal));
    const invoiceNumber = await this.repository.getNextInvoiceNumber();
    const created = await this.repository.createInvoiceWithLines({
      billingAccountId: input.accountId,
      invoiceNumber,
      currency: input.currency,
      dueDate: input.dueDate,
      totalAmount,
      lines,
    });

    const dto = {
      id: created.invoice.id,
      billingAccountId: created.invoice.billingAccountId,
      invoiceNumber: created.invoice.invoiceNumber,
      currency: created.invoice.currency,
      dueDate: created.invoice.dueDate.toISOString(),
      postedAt: created.invoice.postedAt.toISOString(),
      status: created.invoice.status,
      invoiceTotal: created.invoice.totalAmount,
      amountPaid: "0.00",
      amountDue: created.invoice.totalAmount,
      lines: created.lines.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        lineTotal: line.lineTotal,
      })),
    };

    await this.repository.saveIdempotency(scope, input.idempotencyKey, dto as unknown as JsonObject);
    await this.repository.createAuditLog({
      billingAccountId: created.invoice.billingAccountId,
      entityType: "Invoice",
      entityId: created.invoice.id,
      action: "InvoicePosted",
      data: dto as unknown as JsonObject,
    });
    await this.eventPublisher.publish({
      eventType: "InvoicePosted",
      entityType: "Invoice",
      entityId: created.invoice.id,
      data: eventData(dto),
    });

    return dto;
  }

  public async listInvoices(accountId: string): Promise<
    ReadonlyArray<{
      id: string;
      invoiceNumber: string;
      currency: CurrencyCode;
      dueDate: string;
      status: string;
      invoiceTotal: string;
      amountPaid: string;
      amountDue: string;
    }>
  > {
    const invoices = await this.repository.listInvoicesByAccount(accountId);
    return Promise.all(
      invoices.map(async (invoice) => {
        const allocations = await this.repository.listPaymentAllocationsByInvoice(invoice.id);
        const amountPaid = sumMoneyStrings(allocations.map((allocation) => allocation.amount));
        const amountDue = formatMinorUnitsToMoney(
          parseMoneyToMinorUnits(invoice.totalAmount) - parseMoneyToMinorUnits(amountPaid),
        );
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          currency: invoice.currency,
          dueDate: invoice.dueDate.toISOString(),
          status: invoice.status,
          invoiceTotal: invoice.totalAmount,
          amountPaid,
          amountDue,
        };
      }),
    );
  }

  public async getInvoice(invoiceId: string): Promise<{
    id: string;
    invoiceNumber: string;
    billingAccountId: string;
    currency: CurrencyCode;
    status: string;
    dueDate: string;
    invoiceTotal: string;
    amountPaid: string;
    amountDue: string;
    lines: ReadonlyArray<{
      id: string;
      description: string;
      quantity: string;
      unitAmount: string;
      lineTotal: string;
    }>;
  }> {
    const invoice = await this.repository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new BillingApplicationError("INVOICE_NOT_FOUND", "Invoice not found", 404);
    }

    const lines = await this.repository.listInvoiceLines(invoiceId);
    const allocations = await this.repository.listPaymentAllocationsByInvoice(invoiceId);
    const amountPaid = sumMoneyStrings(allocations.map((allocation) => allocation.amount));
    const amountDue = formatMinorUnitsToMoney(
      parseMoneyToMinorUnits(invoice.totalAmount) - parseMoneyToMinorUnits(amountPaid),
    );

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingAccountId: invoice.billingAccountId,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString(),
      invoiceTotal: invoice.totalAmount,
      amountPaid,
      amountDue,
      lines: lines.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        lineTotal: line.lineTotal,
      })),
    };
  }

  public async recordPayment(input: {
    accountId: string;
    amount: string;
    currency: CurrencyCode;
    providerRef: string | null;
    idempotencyKey: string;
  }): Promise<{
    id: string;
    billingAccountId: string;
    amount: string;
    currency: CurrencyCode;
    status: string;
    providerRef: string | null;
    paymentUnallocatedAmount: string;
    createdAt: string;
  }> {
    const scope = "POST /v1/billing/payments";
    const existing = await this.repository.getIdempotency(scope, input.idempotencyKey);
    if (existing) {
      return existing as unknown as ReturnType<BillingService["recordPayment"]> extends Promise<infer T> ? T : never;
    }

    const account = await this.repository.getBillingAccountById(input.accountId);
    if (!account) {
      throw new BillingApplicationError("ACCOUNT_NOT_FOUND", "Billing account not found", 404);
    }
    assertPositiveMoney(input.amount, "amount");

    const payment = await this.repository.createPayment({
      billingAccountId: input.accountId,
      amount: input.amount,
      currency: input.currency,
      providerRef: input.providerRef,
    });

    const dto = {
      id: payment.id,
      billingAccountId: payment.billingAccountId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      providerRef: payment.providerRef,
      paymentUnallocatedAmount: payment.amount,
      createdAt: payment.createdAt.toISOString(),
    };

    await this.repository.saveIdempotency(scope, input.idempotencyKey, dto as unknown as JsonObject);
    await this.repository.createAuditLog({
      billingAccountId: payment.billingAccountId,
      entityType: "Payment",
      entityId: payment.id,
      action: "PaymentReceived",
      data: dto as unknown as JsonObject,
    });
    await this.eventPublisher.publish({
      eventType: "PaymentReceived",
      entityType: "Payment",
      entityId: payment.id,
      data: eventData(dto),
    });

    return dto;
  }

  public async listPayments(accountId: string): Promise<
    ReadonlyArray<{
      id: string;
      amount: string;
      currency: CurrencyCode;
      status: string;
      providerRef: string | null;
      paymentUnallocatedAmount: string;
      createdAt: string;
    }>
  > {
    const payments = await this.repository.listPaymentsByAccount(accountId);
    return Promise.all(
      payments.map(async (payment) => {
        const allocations = await this.repository.listPaymentAllocationsByPayment(payment.id);
        const allocated = sumMoneyStrings(allocations.map((allocation) => allocation.amount));
        const unallocated = formatMinorUnitsToMoney(
          parseMoneyToMinorUnits(payment.amount) - parseMoneyToMinorUnits(allocated),
        );
        return {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          providerRef: payment.providerRef,
          paymentUnallocatedAmount: unallocated,
          createdAt: payment.createdAt.toISOString(),
        };
      }),
    );
  }

  public async getPayment(paymentId: string): Promise<{
    id: string;
    billingAccountId: string;
    amount: string;
    currency: CurrencyCode;
    status: string;
    providerRef: string | null;
    paymentUnallocatedAmount: string;
    createdAt: string;
  }> {
    const payment = await this.repository.getPaymentById(paymentId);
    if (!payment) {
      throw new BillingApplicationError("PAYMENT_NOT_FOUND", "Payment not found", 404);
    }
    const allocations = await this.repository.listPaymentAllocationsByPayment(payment.id);
    const allocated = sumMoneyStrings(allocations.map((allocation) => allocation.amount));
    const unallocated = formatMinorUnitsToMoney(
      parseMoneyToMinorUnits(payment.amount) - parseMoneyToMinorUnits(allocated),
    );
    return {
      id: payment.id,
      billingAccountId: payment.billingAccountId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      providerRef: payment.providerRef,
      paymentUnallocatedAmount: unallocated,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  public async allocatePayment(input: {
    paymentId: string;
    allocations: ReadonlyArray<{ invoiceId: string; amount: string }>;
    idempotencyKey: string;
  }): Promise<{
    paymentId: string;
    allocations: ReadonlyArray<{ invoiceId: string; amount: string }>;
    paymentUnallocatedAmount: string;
  }> {
    const scope = `POST /v1/billing/payments/${input.paymentId}/allocate`;
    const existing = await this.repository.getIdempotency(scope, input.idempotencyKey);
    if (existing) {
      return existing as unknown as ReturnType<BillingService["allocatePayment"]> extends Promise<infer T> ? T : never;
    }

    const payment = await this.repository.getPaymentById(input.paymentId);
    if (!payment) {
      throw new BillingApplicationError("PAYMENT_NOT_FOUND", "Payment not found", 404);
    }
    if (input.allocations.length === 0) {
      throw new BillingApplicationError("ALLOCATIONS_REQUIRED", "At least one allocation is required");
    }

    const existingAllocations = await this.repository.listPaymentAllocationsByPayment(payment.id);
    const existingAllocatedTotal = sumMoneyStrings(existingAllocations.map((allocation) => allocation.amount));
    const requestedTotal = sumMoneyStrings(input.allocations.map((allocation) => allocation.amount));
    const afterTotal = formatMinorUnitsToMoney(
      parseMoneyToMinorUnits(existingAllocatedTotal) + parseMoneyToMinorUnits(requestedTotal),
    );
    assertNoOverAllocation(afterTotal, payment.amount, "Payment over-allocation is not allowed");

    for (const allocation of input.allocations) {
      assertPositiveMoney(allocation.amount, "allocation.amount");

      const invoice = await this.repository.getInvoiceById(allocation.invoiceId);
      if (!invoice) {
        throw new BillingApplicationError("INVOICE_NOT_FOUND", `Invoice ${allocation.invoiceId} not found`, 404);
      }
      assertCurrencyMatch(invoice.currency, payment.currency);

      const invoiceAllocations = await this.repository.listPaymentAllocationsByInvoice(invoice.id);
      const invoicePaid = sumMoneyStrings(invoiceAllocations.map((item) => item.amount));
      const invoiceAfterPaid = formatMinorUnitsToMoney(
        parseMoneyToMinorUnits(invoicePaid) + parseMoneyToMinorUnits(allocation.amount),
      );
      assertNoOverAllocation(invoiceAfterPaid, invoice.totalAmount, "Invoice over-allocation is not allowed");

      await this.repository.createPaymentAllocation({
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: allocation.amount,
      });

      const nextStatus = computeInvoiceStatus(invoice.totalAmount, invoiceAfterPaid);
      if (nextStatus !== invoice.status) {
        await this.repository.updateInvoiceStatus(invoice.id, nextStatus);
        await this.eventPublisher.publish({
          eventType: "InvoiceStatusChanged",
          entityType: "Invoice",
          entityId: invoice.id,
          data: eventData({
            invoiceId: invoice.id,
            status: nextStatus,
            invoiceTotal: invoice.totalAmount,
            amountPaid: invoiceAfterPaid,
          }),
        });
      }
    }

    const finalAllocations = await this.repository.listPaymentAllocationsByPayment(payment.id);
    const allocatedTotal = sumMoneyStrings(finalAllocations.map((allocation) => allocation.amount));
    const unallocated = formatMinorUnitsToMoney(
      parseMoneyToMinorUnits(payment.amount) - parseMoneyToMinorUnits(allocatedTotal),
    );

    const paymentStatus = computePaymentStatus(payment.amount, allocatedTotal);
    if (payment.status !== paymentStatus) {
      await this.repository.updatePaymentStatus(payment.id, paymentStatus);
    }

    const dto = {
      paymentId: payment.id,
      allocations: input.allocations.map((allocation) => ({
        invoiceId: allocation.invoiceId,
        amount: allocation.amount,
      })),
      paymentUnallocatedAmount: unallocated,
    };

    await this.repository.saveIdempotency(scope, input.idempotencyKey, dto as unknown as JsonObject);
    await this.repository.createAuditLog({
      billingAccountId: payment.billingAccountId,
      entityType: "Payment",
      entityId: payment.id,
      action: "PaymentAllocated",
      data: dto as unknown as JsonObject,
    });
    await this.eventPublisher.publish({
      eventType: "PaymentAllocated",
      entityType: "Payment",
      entityId: payment.id,
      data: eventData(dto),
    });

    return dto;
  }
}
