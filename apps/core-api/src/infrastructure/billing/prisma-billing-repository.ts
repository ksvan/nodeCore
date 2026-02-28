import type {
  BillingAccount,
  BillingObligation,
  BillingIdempotencyKey,
  CurrencyCode,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentAllocation,
  PrismaClient,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import type {
  BillingAccountRecord,
  BillingObligationRecord,
  BillingRepository,
  InvoiceLineRecord,
  InvoiceRecord,
  JsonObject,
  PaymentAllocationRecord,
  PaymentRecord,
} from "../../application/billing/ports/billing.js";

const asJsonObject = (value: unknown): JsonObject => (value ?? {}) as JsonObject;
const toInputJson = (value: JsonObject): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const toBillingAccountRecord = (row: BillingAccount): BillingAccountRecord => ({
  id: row.id,
  partyId: row.partyId,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toInvoiceRecord = (row: Invoice): InvoiceRecord => ({
  id: row.id,
  billingAccountId: row.billingAccountId,
  invoiceNumber: row.invoiceNumber,
  status: row.status,
  currency: row.currency as CurrencyCode,
  dueDate: row.dueDate,
  totalAmount: row.totalAmount.toFixed(2),
  postedAt: row.postedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toInvoiceLineRecord = (row: InvoiceLine): InvoiceLineRecord => ({
  id: row.id,
  invoiceId: row.invoiceId,
  billingObligationId: row.billingObligationId,
  description: row.description,
  quantity: row.quantity.toString(),
  unitAmount: row.unitAmount.toFixed(2),
  lineTotal: row.lineTotal.toFixed(2),
  createdAt: row.createdAt,
});

const toPaymentRecord = (row: Payment): PaymentRecord => ({
  id: row.id,
  billingAccountId: row.billingAccountId,
  amount: row.amount.toFixed(2),
  currency: row.currency as CurrencyCode,
  status: row.status,
  providerRef: row.providerRef,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toPaymentAllocationRecord = (row: PaymentAllocation): PaymentAllocationRecord => ({
  id: row.id,
  paymentId: row.paymentId,
  invoiceId: row.invoiceId,
  amount: row.amount.toFixed(2),
  createdAt: row.createdAt,
});

const toBillingObligationRecord = (row: BillingObligation): BillingObligationRecord => ({
  id: row.id,
  policyId: row.policyId,
  policyTransactionId: row.policyTransactionId,
  termId: row.termId,
  billingAccountId: row.billingAccountId,
  amount: row.amount.toFixed(2),
  currency: row.currency as CurrencyCode,
  dueDate: row.dueDate,
  status: row.status,
  createdAt: row.createdAt,
});

export class PrismaBillingRepository implements BillingRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createBillingAccount(input: { partyId: string }): Promise<BillingAccountRecord> {
    const created = await this.prisma.billingAccount.create({
      data: { partyId: input.partyId },
    });
    return toBillingAccountRecord(created);
  }

  public async listBillingAccounts(query?: string): Promise<ReadonlyArray<BillingAccountRecord>> {
    const where = query
      ? {
          OR: [
            { id: { contains: query, mode: "insensitive" as const } },
            { partyId: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : undefined;
    const rows = await this.prisma.billingAccount.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => toBillingAccountRecord(row));
  }

  public async getBillingAccountById(accountId: string): Promise<BillingAccountRecord | null> {
    const row = await this.prisma.billingAccount.findUnique({ where: { id: accountId } });
    return row ? toBillingAccountRecord(row) : null;
  }

  public async getNextInvoiceNumber(): Promise<string> {
    const latest = await this.prisma.invoice.findFirst({
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true },
    });
    const seq = latest ? Number.parseInt(latest.invoiceNumber.replace("INV-", ""), 10) || 0 : 0;
    return `INV-${String(seq + 1).padStart(6, "0")}`;
  }

  public async createInvoiceWithLines(input: {
    billingAccountId: string;
    invoiceNumber: string;
    currency: CurrencyCode;
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
    const created = await this.prisma.invoice.create({
      data: {
        billingAccountId: input.billingAccountId,
        invoiceNumber: input.invoiceNumber,
        currency: input.currency,
        dueDate: input.dueDate,
        totalAmount: new Prisma.Decimal(input.totalAmount),
        status: "POSTED",
        lines: {
          create: input.lines.map((line) => ({
            description: line.description,
            quantity: new Prisma.Decimal(line.quantity),
            unitAmount: new Prisma.Decimal(line.unitAmount),
            lineTotal: new Prisma.Decimal(line.lineTotal),
            billingObligationId: line.billingObligationId ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    return {
      invoice: toInvoiceRecord(created),
      lines: created.lines.map((line) => toInvoiceLineRecord(line)),
    };
  }

  public async listInvoicesByAccount(accountId: string): Promise<ReadonlyArray<InvoiceRecord>> {
    const rows = await this.prisma.invoice.findMany({
      where: { billingAccountId: accountId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => toInvoiceRecord(row));
  }

  public async getInvoiceById(invoiceId: string): Promise<InvoiceRecord | null> {
    const row = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    return row ? toInvoiceRecord(row) : null;
  }

  public async listInvoiceLines(invoiceId: string): Promise<ReadonlyArray<InvoiceLineRecord>> {
    const rows = await this.prisma.invoiceLine.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => toInvoiceLineRecord(row));
  }

  public async updateInvoiceStatus(invoiceId: string, status: InvoiceRecord["status"]): Promise<InvoiceRecord> {
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    });
    return toInvoiceRecord(updated);
  }

  public async createPayment(input: {
    billingAccountId: string;
    amount: string;
    currency: CurrencyCode;
    providerRef: string | null;
  }): Promise<PaymentRecord> {
    const created = await this.prisma.payment.create({
      data: {
        billingAccountId: input.billingAccountId,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        providerRef: input.providerRef,
      },
    });
    return toPaymentRecord(created);
  }

  public async listPaymentsByAccount(accountId: string): Promise<ReadonlyArray<PaymentRecord>> {
    const rows = await this.prisma.payment.findMany({
      where: { billingAccountId: accountId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => toPaymentRecord(row));
  }

  public async getPaymentById(paymentId: string): Promise<PaymentRecord | null> {
    const row = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    return row ? toPaymentRecord(row) : null;
  }

  public async updatePaymentStatus(paymentId: string, status: PaymentRecord["status"]): Promise<PaymentRecord> {
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
    return toPaymentRecord(updated);
  }

  public async createPaymentAllocation(input: {
    paymentId: string;
    invoiceId: string;
    amount: string;
  }): Promise<PaymentAllocationRecord> {
    const created = await this.prisma.paymentAllocation.create({
      data: {
        paymentId: input.paymentId,
        invoiceId: input.invoiceId,
        amount: new Prisma.Decimal(input.amount),
      },
    });
    return toPaymentAllocationRecord(created);
  }

  public async listPaymentAllocationsByPayment(
    paymentId: string,
  ): Promise<ReadonlyArray<PaymentAllocationRecord>> {
    const rows = await this.prisma.paymentAllocation.findMany({
      where: { paymentId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => toPaymentAllocationRecord(row));
  }

  public async listPaymentAllocationsByInvoice(
    invoiceId: string,
  ): Promise<ReadonlyArray<PaymentAllocationRecord>> {
    const rows = await this.prisma.paymentAllocation.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => toPaymentAllocationRecord(row));
  }

  public async createBillingObligation(input: {
    policyId: string;
    policyTransactionId: string;
    termId: string;
    billingAccountId: string | null;
    amount: string;
    currency: CurrencyCode;
    dueDate: Date;
  }): Promise<BillingObligationRecord> {
    const created = await this.prisma.billingObligation.create({
      data: {
        policyId: input.policyId,
        policyTransactionId: input.policyTransactionId,
        termId: input.termId,
        billingAccountId: input.billingAccountId,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        dueDate: input.dueDate,
      },
    });
    return toBillingObligationRecord(created);
  }

  public async getBillingObligationById(obligationId: string): Promise<BillingObligationRecord | null> {
    const row = await this.prisma.billingObligation.findUnique({ where: { id: obligationId } });
    return row ? toBillingObligationRecord(row) : null;
  }

  public async updateBillingObligation(input: {
    obligationId: string;
    status?: BillingObligationRecord["status"];
    billingAccountId?: string | null;
  }): Promise<BillingObligationRecord> {
    const updated = await this.prisma.billingObligation.update({
      where: { id: input.obligationId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "billingAccountId")
          ? { billingAccountId: input.billingAccountId ?? null }
          : {}),
      },
    });
    return toBillingObligationRecord(updated);
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
    const rows = await this.prisma.billingObligation.findMany({
      where: { policyId, createdAt: { lte: asOf } },
      include: {
        invoiceLines: {
          include: {
            invoice: {
              include: {
                allocations: {
                  where: { createdAt: { lte: asOf } },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) => ({
      ...toBillingObligationRecord(row),
      invoices: row.invoiceLines
        .filter((line) => line.invoice.createdAt <= asOf)
        .map((line) => ({
          invoiceId: line.invoice.id,
          invoiceNumber: line.invoice.invoiceNumber,
          invoiceStatus: line.invoice.status,
          invoiceTotal: line.invoice.totalAmount.toFixed(2),
          amountPaid: line.invoice.allocations
            .reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0))
            .toFixed(2),
        })),
    }));
  }

  public async getIdempotency(scope: string, key: string): Promise<JsonObject | null> {
    const row: BillingIdempotencyKey | null = await this.prisma.billingIdempotencyKey.findUnique({
      where: { commandScope_idempotencyKey: { commandScope: scope, idempotencyKey: key } },
    });
    return row ? asJsonObject(row.responseJson) : null;
  }

  public async saveIdempotency(scope: string, key: string, responseJson: JsonObject): Promise<void> {
    await this.prisma.billingIdempotencyKey.create({
      data: {
        commandScope: scope,
        idempotencyKey: key,
        responseJson: toInputJson(responseJson),
      },
    });
  }

  public async createAuditLog(input: {
    billingAccountId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    data: JsonObject;
  }): Promise<void> {
    const data: Prisma.BillingAuditLogCreateInput = {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      data: toInputJson(input.data),
    };
    if (input.billingAccountId) {
      data.billingAccount = { connect: { id: input.billingAccountId } };
    }
    await this.prisma.billingAuditLog.create({ data });
  }
}
