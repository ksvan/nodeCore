export class ProductManagementApplicationError extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "ProductManagementApplicationError";
    this.statusCode = statusCode;
  }
}
