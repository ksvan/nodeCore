export class PolicyDomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PolicyDomainError";
  }
}
