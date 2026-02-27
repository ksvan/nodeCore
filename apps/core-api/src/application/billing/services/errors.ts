export class BillingApplicationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = "BillingApplicationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
