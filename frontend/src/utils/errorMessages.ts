import { ErrorCodes } from "../../../types/shared";

export function getUserFriendlyErrorMessage(
  errorCode: string,
  operation: "sync" | "restore"
): string {
  switch (errorCode) {
    case ErrorCodes.NotAuthenticated: {
      return "Please sign in to Google first.";
    }
    case ErrorCodes.NotFound: {
      if (operation === "restore") {
        return "No backup found in Google Drive.";
      } else {
        return "Resource not found.";
      }
    }
    case ErrorCodes.DriveApi: {
      return "A Google Drive error occurred.";
    }
    case ErrorCodes.Network: {
      return "Network error. Please check your connection and try again.";
    }
    case ErrorCodes.Crypto: {
      if (operation === "restore") {
        return "Decryption failed. Wrong password?";
      } else {
        return "Encryption failed.";
      }
    }
    default: {
      if (operation === "restore") {
        return "Restore failed";
      } else {
        return "Sync failed";
      }
    }
  }
}
