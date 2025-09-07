import { ErrorCodes } from "../types/shared";

export class MainProcessError extends Error {
  public readonly code: string;
  public readonly status?: number;

  constructor(
    code: string,
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
    super(ErrorCodes.Canceled, message, undefined, options);
  }
}

export class NotAuthenticatedError extends MainProcessError {
  constructor(message = "Not authenticated", options?: { cause?: unknown }) {
    super(ErrorCodes.NotAuthenticated, message, undefined, options);
  }
}

export class OAuthConfigError extends MainProcessError {
  constructor(
    message = "OAuth configuration error",
    options?: { cause?: unknown }
  ) {
    super(ErrorCodes.OAuthConfig, message, undefined, options);
  }
}

export class TokenRefreshFailedError extends MainProcessError {
  constructor(
    message = "Token refresh failed",
    status?: number,
    options?: { cause?: unknown }
  ) {
    super(ErrorCodes.TokenRefreshFailed, message, status, options);
  }
}

export class DropboxApiError extends MainProcessError {
  constructor(
    message = "Cloud storage API error",
    status?: number,
    options?: { cause?: unknown }
  ) {
    super(ErrorCodes.DropboxApi, message, status, options);
  }
}

export class NetworkError extends MainProcessError {
  constructor(message = "Network error", options?: { cause?: unknown }) {
    super(ErrorCodes.Network, message, undefined, options);
  }
}

export class NotFoundError extends MainProcessError {
  constructor(message = "Resource not found", options?: { cause?: unknown }) {
    super(ErrorCodes.NotFound, message, undefined, options);
  }
}

export class CryptoError extends MainProcessError {
  constructor(
    message = "Cryptography/storage error",
    options?: { cause?: unknown }
  ) {
    super(ErrorCodes.Crypto, message, undefined, options);
  }
}

export class SafeStorageError extends MainProcessError {
  constructor(message = "Safe storage error", options?: { cause?: unknown }) {
    super(ErrorCodes.SafeStorage, message, undefined, options);
  }
}

export class UnknownMainProcessError extends MainProcessError {
  constructor(message = "Unknown error", options?: { cause?: unknown }) {
    super(ErrorCodes.Unknown, message, undefined, options);
  }
}
