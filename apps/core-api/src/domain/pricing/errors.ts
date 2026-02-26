export class PricingDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PricingDomainError";
  }
}
