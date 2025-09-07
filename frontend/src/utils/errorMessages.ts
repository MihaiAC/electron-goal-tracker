import { ErrorCodes } from "../../../types/shared";

export function getUserFriendlyErrorMessage(
  errorCode: string,
  operation?: "sync" | "restore"
): string {
  switch (errorCode) {
    case ErrorCodes.NotAuthenticated: {
      return "Please sign in to Dropbox first.";
    }
    case ErrorCodes.NotFound: {
      if (operation === "restore") {
        return "No backup found in Dropbox.";
      } else {
        return "Resource not found.";
      }
    }
    case ErrorCodes.DropboxApi: {
      return "A Dropbox API error occurred.";
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
