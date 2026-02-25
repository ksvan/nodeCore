export class DomainInvariantError extends Error {
    constructor(message) {
        super(message);
        this.name = "DomainInvariantError";
    }
}
