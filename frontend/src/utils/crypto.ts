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

// Encrypt data with password.
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
      salt: btoa(String.fromCharCode(...new Uint8Array(salt))),
      iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
      encryptedData: btoa(
        String.fromCharCode(...new Uint8Array(encryptedData))
      ),
    };

    return JSON.stringify(bundle);
  } catch (error) {
    console.error("Encryption failed: ", error);
    throw new Error("Failed to encrypt data");
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
      throw new Error("Failed to parse JSON bundle");
    }

    console.error("Decryption failed: ", error);
    throw new Error("Failed to decrypt data. Wrong password?");
  }
}
