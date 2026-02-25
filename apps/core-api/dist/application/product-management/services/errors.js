export class ProductManagementApplicationError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "ProductManagementApplicationError";
        this.statusCode = statusCode;
    }
}
