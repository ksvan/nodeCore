import { BillingDomainError } from "./errors.js";
import { parseMoneyToMinorUnits } from "./money.js";

export const assertPositiveMoney = (amount: string, field: string): void => {
  if (parseMoneyToMinorUnits(amount) <= 0n) {
    throw new BillingDomainError(`${field} must be greater than zero`);
  }
};

export const assertCurrencyMatch = (invoiceCurrency: string, paymentCurrency: string): void => {
  if (invoiceCurrency !== paymentCurrency) {
    throw new BillingDomainError("Currency mismatch between invoice and payment");
  }
};

export const assertNoOverAllocation = (allocated: string, maximum: string, message: string): void => {
  if (parseMoneyToMinorUnits(allocated) > parseMoneyToMinorUnits(maximum)) {
    throw new BillingDomainError(message);
  }
};
