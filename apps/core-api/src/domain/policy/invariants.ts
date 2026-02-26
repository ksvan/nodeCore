import { PolicyDomainError } from "./errors.js";

export type PolicyTransactionType = "NEW_BUSINESS" | "ENDORSEMENT";
export type PolicyTransactionStatus = "DRAFT" | "COMMITTED";

export const assertEffectiveRange = (effectiveFrom: Date, effectiveTo: Date): void => {
  if (effectiveTo <= effectiveFrom) {
    throw new PolicyDomainError("effectiveTo must be later than effectiveFrom");
  }
};

export const assertDraftTransactionEditable = (status: PolicyTransactionStatus): void => {
  if (status !== "DRAFT") {
    throw new PolicyDomainError("Only DRAFT transactions can be edited");
  }
};

export const assertDraftTransactionCommittable = (status: PolicyTransactionStatus): void => {
  if (status !== "DRAFT") {
    throw new PolicyDomainError("Only DRAFT transactions can be committed");
  }
};

export const assertSupportedTransactionType = (type: PolicyTransactionType): void => {
  if (type !== "NEW_BUSINESS" && type !== "ENDORSEMENT") {
    throw new PolicyDomainError("Unsupported policy transaction type");
  }
};
