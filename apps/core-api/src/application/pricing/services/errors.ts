export class PricingApplicationError extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "PricingApplicationError";
    this.statusCode = statusCode;
  }
}
