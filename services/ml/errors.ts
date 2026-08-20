export interface MLServiceErrorOptions {
  code: string;
  status: number;
  details?: unknown;
  requestId?: string;
  cause?: unknown;
}

/** A failure reported by the ML service (or an unparseable response from it). */
export class MLServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(message: string, options: MLServiceErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "MLServiceError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

/** The ML service could not be reached at all (network failure or timeout). */
export class MLServiceUnavailableError extends MLServiceError {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { code: "service_unavailable", status: 503, cause: options.cause });
    this.name = "MLServiceUnavailableError";
  }
}
