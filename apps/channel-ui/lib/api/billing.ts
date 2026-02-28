import { apiRequest } from "./client";
import type {
  BillingAccountDto,
  BillingAccountListItemDto,
  BillingInvoiceDto,
  BillingInvoiceListItemDto,
  BillingObligationInvoiceDto,
  BillingPaymentDto,
  BillingPaymentListItemDto,
  CurrencyCode,
} from "./types";

const createId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

export const billingApi = {
  listAccounts: (query?: string) =>
    apiRequest<ReadonlyArray<BillingAccountListItemDto>>(
      `/v1/billing/accounts${query ? `?query=${encodeURIComponent(query)}` : ""}`,
    ),

  createAccount: (input: { partyId: string }) =>
    apiRequest<BillingAccountListItemDto>("/v1/billing/accounts", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getAccount: (accountId: string) =>
    apiRequest<BillingAccountDto>(`/v1/billing/accounts/${accountId}`),

  createInvoice: (
    accountId: string,
    input: {
      dueDate: string;
      currency: CurrencyCode;
      lines: ReadonlyArray<{
        description: string;
        quantity: string;
        unitAmount: string;
      }>;
    },
  ) =>
    apiRequest<BillingInvoiceDto>(`/v1/billing/accounts/${accountId}/invoices`, {
      method: "POST",
      headers: { "idempotency-key": createId() },
      body: JSON.stringify(input),
    }),

  listInvoices: (accountId: string) =>
    apiRequest<ReadonlyArray<BillingInvoiceListItemDto>>(
      `/v1/billing/accounts/${accountId}/invoices`,
    ),

  getInvoice: (invoiceId: string) =>
    apiRequest<BillingInvoiceDto>(`/v1/billing/invoices/${invoiceId}`),

  generateInvoiceFromObligation: (
    obligationId: string,
    input: {
      dueDate: string;
      billingAccountId?: string | null;
    },
  ) =>
    apiRequest<BillingObligationInvoiceDto>(`/v1/billing/obligations/${obligationId}/invoice`, {
      method: "POST",
      headers: { "idempotency-key": createId() },
      body: JSON.stringify(input),
    }),

  recordPayment: (input: {
    accountId: string;
    amount: string;
    currency: CurrencyCode;
    providerRef?: string | null;
  }) =>
    apiRequest<BillingPaymentDto>("/v1/billing/payments", {
      method: "POST",
      headers: { "idempotency-key": createId() },
      body: JSON.stringify(input),
    }),

  listPayments: (accountId: string) =>
    apiRequest<ReadonlyArray<BillingPaymentListItemDto>>(
      `/v1/billing/accounts/${accountId}/payments`,
    ),

  getPayment: (paymentId: string) =>
    apiRequest<BillingPaymentDto>(`/v1/billing/payments/${paymentId}`),

  allocatePayment: (
    paymentId: string,
    input: { allocations: ReadonlyArray<{ invoiceId: string; amount: string }> },
  ) =>
    apiRequest<{
      paymentId: string;
      allocations: ReadonlyArray<{ invoiceId: string; amount: string }>;
      paymentUnallocatedAmount: string;
    }>(`/v1/billing/payments/${paymentId}/allocate`, {
      method: "POST",
      headers: { "idempotency-key": createId() },
      body: JSON.stringify(input),
    }),
};
