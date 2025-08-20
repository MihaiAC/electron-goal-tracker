import type { MainProcessErrorCode } from "../types/electron";

export class MainProcessError extends Error {
  public readonly code: MainProcessErrorCode;
  public readonly status?: number;

  constructor(
    code: MainProcessErrorCode,
    message?: string,
    status?: number,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class CanceledError extends MainProcessError {
  constructor(message = "Operation canceled", options?: { cause?: unknown }) {
    super("Canceled", message, undefined, options);
  }
}

export class NotAuthenticatedError extends MainProcessError {
  constructor(message = "Not authenticated", options?: { cause?: unknown }) {
    super("NotAuthenticated", message, undefined, options);
  }
}

export class OAuthConfigError extends MainProcessError {
  constructor(
    message = "OAuth configuration error",
    options?: { cause?: unknown }
  ) {
    super("OAuthConfig", message, undefined, options);
  }
}

export class TokenRefreshFailedError extends MainProcessError {
  constructor(
    message = "Token refresh failed",
    status?: number,
    options?: { cause?: unknown }
  ) {
    super("TokenRefreshFailed", message, status, options);
  }
}

export class DriveApiError extends MainProcessError {
  constructor(
    message = "Google Drive API error",
    status?: number,
    options?: { cause?: unknown }
  ) {
    super("DriveApi", message, status, options);
  }
}

export class NetworkError extends MainProcessError {
  constructor(message = "Network error", options?: { cause?: unknown }) {
    super("Network", message, undefined, options);
  }
}

export class NotFoundError extends MainProcessError {
  constructor(message = "Resource not found", options?: { cause?: unknown }) {
    super("NotFound", message, undefined, options);
  }
}

export class CryptoError extends MainProcessError {
  constructor(
    message = "Cryptography/storage error",
    options?: { cause?: unknown }
  ) {
    super("Crypto" as MainProcessErrorCode, message, undefined, options);
  }
}

export class UnknownMainProcessError extends MainProcessError {
  constructor(message = "Unknown error", options?: { cause?: unknown }) {
    super("Unknown", message, undefined, options);
  }
}
