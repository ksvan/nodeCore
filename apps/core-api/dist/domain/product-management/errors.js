export class ProductManagementDomainError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProductManagementDomainError";
    }
}
