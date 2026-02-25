export class ProductManagementDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProductManagementDomainError";
  }
}
