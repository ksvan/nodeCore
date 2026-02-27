export class BillingDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BillingDomainError";
  }
}
