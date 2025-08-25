// Helpers for working with IPC error wrappers

export interface ErrorWrapper {
  code: string;
  message?: string;
  status?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isErrorWrapper(error: unknown): error is ErrorWrapper {
  if (!isRecord(error)) {
    return false;
  }

  const possibleCode = error["code"];
  if (typeof possibleCode !== "string") {
    return false;
  }

  return true;
}

export function extractMainProcessErrorCode(
  error: unknown
): string | undefined {
  if (isErrorWrapper(error)) {
    return error.code;
  } else {
    return undefined;
  }
}
