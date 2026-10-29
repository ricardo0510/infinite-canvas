export class ApiException extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly status = 400,
    readonly data: unknown = null,
  ) {
    super(message);
    this.name = "ApiException";
  }
}
