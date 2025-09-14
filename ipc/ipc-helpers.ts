import { ipcMain } from "electron";
import { ErrorCodes } from "../types/shared";
import { MainProcessError } from "../utils/main-process-errors";

/**
 * Serializes typed errors across IPC boundary.
 * Converts MainProcessError instances to a structured format that can be sent via IPC.
 *
 * @param error - The error to serialize
 * @returns Structured error object with code, message, and optional status
 */
function toIpcErrorWrapper(error: unknown): {
  code: string;
  message?: string;
  status?: number;
} {
  if (error instanceof MainProcessError) {
    return { code: error.code, message: error.message, status: error.status };
  } else if (error instanceof Error) {
    return { code: ErrorCodes.Unknown, message: error.message };
  } else {
    return { code: ErrorCodes.Unknown, message: String(error) };
  }
}

/**
 * Wrapper for IPC handlers that provides consistent error handling and response format.
 * All handlers return { ok: true, data } on success or { ok: false, error } on failure.
 *
 * @param channel - The IPC channel name
 * @param handler - The async handler function
 */
export function handleInvoke<T>(
  channel: string,
  handler: (...args: any[]) => Promise<T> | T
) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const data = await handler(...args);
      return { ok: true, data } as const;
    } catch (error) {
      // Log detailed main-process error info for diagnostics
      if (error instanceof MainProcessError) {
        console.error(`[ipc:${channel}] main error`, {
          code: error.code,
          status: error.status,
          message: error.message,
        });
      } else {
        console.error(`[ipc:${channel}] unknown error`, error);
      }
      return { ok: false, error: toIpcErrorWrapper(error) } as const;
    }
  });
}
