import { ErrorCodes } from "../../../types/shared";

// Generate the key from the password + salt.
const getKeyFromPasswordAndSalt = async (
  password: string,
  salt: ArrayBuffer
): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Create base key.
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Return derived key.
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

// Encrypt/decrypt error that uses the same code as main process errors.
export class CryptoError extends Error {
  readonly code: string = ErrorCodes.Crypto;

  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

// Convert a Uint8Array to base64 without overflowing the call stack.
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunks
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export async function encryptData(
  data: string,
  password: string
): Promise<string> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getKeyFromPasswordAndSalt(password, salt);

    const encodedData = new TextEncoder().encode(data);
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encodedData
    );

    // Save salt, iv, and encrypted data as base64 strings.
    const bundle = {
      salt: uint8ArrayToBase64(new Uint8Array(salt)),
      iv: uint8ArrayToBase64(new Uint8Array(iv)),
      encryptedData: uint8ArrayToBase64(new Uint8Array(encryptedData)),
    };

    return JSON.stringify(bundle);
  } catch (error) {
    console.error("Encryption failed: ", error);
    throw new CryptoError("Failed to encrypt data");
  }
}

function base64ToUint8Array(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (char) => char.charCodeAt(0));
}

// Decrypt data with password.
export async function decryptData(
  bundle: string,
  password: string
): Promise<string> {
  try {
    const { salt, iv, encryptedData } = JSON.parse(bundle);

    // Convert base64 strings back to ArrayBuffers.
    const saltBuffer = base64ToUint8Array(salt);
    const ivBuffer = base64ToUint8Array(iv);
    const encryptedDataBuffer = base64ToUint8Array(encryptedData);

    // Get the key.
    const key = await getKeyFromPasswordAndSalt(password, saltBuffer);

    // Decrypt the data => encoded data.
    const encodedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      key,
      encryptedDataBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(encodedData);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new CryptoError("Failed to parse JSON bundle");
    }

    console.error("Decryption failed: ", error);
    throw new CryptoError("Failed to decrypt data. Wrong password?");
  }
}
