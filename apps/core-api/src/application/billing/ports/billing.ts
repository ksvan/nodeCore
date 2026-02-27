export type CurrencyCode = "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
export type JsonObject = Record<string, unknown>;

export interface BillingAccountRecord {
  id: string;
  partyId: string;
  status: "ACTIVE" | "CLOSED";
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceRecord {
  id: string;
  billingAccountId: string;
  invoiceNumber: string;
  status: "DRAFT" | "POSTED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  currency: CurrencyCode;
  dueDate: Date;
  totalAmount: string;
  postedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineRecord {
  id: string;
  invoiceId: string;
  description: string;
  quantity: string;
  unitAmount: string;
  lineTotal: string;
  createdAt: Date;
}

export interface PaymentRecord {
  id: string;
  billingAccountId: string;
  amount: string;
  currency: CurrencyCode;
  status: "RECEIVED" | "ALLOCATED";
  providerRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentAllocationRecord {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: string;
  createdAt: Date;
}

export interface BillingRepository {
  createBillingAccount(input: { partyId: string }): Promise<BillingAccountRecord>;
  listBillingAccounts(query?: string): Promise<ReadonlyArray<BillingAccountRecord>>;
  getBillingAccountById(accountId: string): Promise<BillingAccountRecord | null>;

  getNextInvoiceNumber(): Promise<string>;
  createInvoiceWithLines(input: {
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
    }>;
  }): Promise<{ invoice: InvoiceRecord; lines: ReadonlyArray<InvoiceLineRecord> }>;
  listInvoicesByAccount(accountId: string): Promise<ReadonlyArray<InvoiceRecord>>;
  getInvoiceById(invoiceId: string): Promise<InvoiceRecord | null>;
  listInvoiceLines(invoiceId: string): Promise<ReadonlyArray<InvoiceLineRecord>>;
  updateInvoiceStatus(invoiceId: string, status: InvoiceRecord["status"]): Promise<InvoiceRecord>;

  createPayment(input: {
    billingAccountId: string;
    amount: string;
    currency: CurrencyCode;
    providerRef: string | null;
  }): Promise<PaymentRecord>;
  listPaymentsByAccount(accountId: string): Promise<ReadonlyArray<PaymentRecord>>;
  getPaymentById(paymentId: string): Promise<PaymentRecord | null>;
  updatePaymentStatus(paymentId: string, status: PaymentRecord["status"]): Promise<PaymentRecord>;

  createPaymentAllocation(input: {
    paymentId: string;
    invoiceId: string;
    amount: string;
  }): Promise<PaymentAllocationRecord>;
  listPaymentAllocationsByPayment(paymentId: string): Promise<ReadonlyArray<PaymentAllocationRecord>>;
  listPaymentAllocationsByInvoice(invoiceId: string): Promise<ReadonlyArray<PaymentAllocationRecord>>;

  getIdempotency(scope: string, key: string): Promise<JsonObject | null>;
  saveIdempotency(scope: string, key: string, responseJson: JsonObject): Promise<void>;

  createAuditLog(input: {
    billingAccountId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    data: JsonObject;
  }): Promise<void>;
}

export interface DomainEventPublisher {
  publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}
