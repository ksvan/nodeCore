import { PolicyDomainError } from "./errors.js";

export type PolicyTransactionType = "NEW_BUSINESS" | "ENDORSEMENT";
export type PolicyTransactionStatus = "DRAFT" | "COMMITTED";
export type PolicyRiskType = "VEHICLE" | "PROPERTY" | "LOCATION" | "PERSON" | "OTHER";
export type CoverageTermValueType = "MONEY" | "NUMBER" | "STRING" | "BOOLEAN";

export const assertDateOrder = (from: Date, to: Date, label: string): void => {
  if (to <= from) {
    throw new PolicyDomainError(`${label} end must be after start`);
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

export const assertCoverageTermValueShape = (input: {
  valueType: CoverageTermValueType;
  moneyAmount: string | null;
  moneyCurrency: string | null;
  numberValue: string | null;
  stringValue: string | null;
  booleanValue: boolean | null;
}): void => {
  const populatedCount = [
    input.moneyAmount !== null || input.moneyCurrency !== null,
    input.numberValue !== null,
    input.stringValue !== null,
    input.booleanValue !== null,
  ].filter(Boolean).length;

  if (populatedCount !== 1) {
    throw new PolicyDomainError("Coverage term must set exactly one typed value");
  }

  if (input.valueType === "MONEY" && (input.moneyAmount === null || input.moneyCurrency === null)) {
    throw new PolicyDomainError("MONEY terms require moneyAmount and moneyCurrency");
  }
  if (input.valueType === "NUMBER" && input.numberValue === null) {
    throw new PolicyDomainError("NUMBER terms require numberValue");
  }
  if (input.valueType === "STRING" && input.stringValue === null) {
    throw new PolicyDomainError("STRING terms require stringValue");
  }
  if (input.valueType === "BOOLEAN" && input.booleanValue === null) {
    throw new PolicyDomainError("BOOLEAN terms require booleanValue");
  }
};
