import { BillingDomainError } from "./errors.js";

const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

export const parseMoneyToMinorUnits = (amount: string): bigint => {
  if (!MONEY_PATTERN.test(amount)) {
    throw new BillingDomainError("Invalid monetary amount format");
  }
  const negative = amount.startsWith("-");
  const raw = negative ? amount.slice(1) : amount;
  const [wholePart, fraction = ""] = raw.split(".");
  const whole = wholePart ?? "0";
  const padded = `${fraction}00`.slice(0, 2);
  const minor = BigInt(whole) * 100n + BigInt(padded);
  return negative ? -minor : minor;
};

export const formatMinorUnitsToMoney = (value: bigint): string => {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${negative ? "-" : ""}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
};

export const sumMoneyStrings = (values: ReadonlyArray<string>): string => {
  const total = values.reduce((acc, value) => acc + parseMoneyToMinorUnits(value), 0n);
  return formatMinorUnitsToMoney(total);
};
