import { describe, test, expect } from "vitest";
import { encryptData, decryptData } from "./crypto";
import { TextEncoder, TextDecoder } from "util";
import { webcrypto } from "node:crypto";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Set up the Web Crypto API
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
  enumerable: true,
  writable: true,
});

describe("crypto.ts encrypt/decrypt", () => {
  const password = "test-password-123";
  const wrongPassword = "invalid-password";
  const sample = "The quick brown fox jumps over the lazy dog. 🦊🐶";
  const empty = "";

  test("test basic expected behaviour", async () => {
    const bundle = await encryptData(sample, password);
    const decrypted = await decryptData(bundle, password);
    expect(decrypted).toBe(sample);
  });

  test("handle empty string payloads", async () => {
    const bundle = await encryptData(empty, password);
    const decrypted = await decryptData(bundle, password);
    expect(decrypted).toBe(empty);
  });

  test("reject decryption with wrong password", async () => {
    const bundle = await encryptData(sample, password);
    await expect(decryptData(bundle, wrongPassword)).rejects.toThrow(
      /Failed to decrypt data/
    );
  });

  test("reject malformed JSON input", async () => {
    await expect(decryptData("not-a-json", password)).rejects.toThrow(
      /Failed to parse JSON/
    );
  });

  test("detect tampered ciphertext", async () => {
    const bundle = await encryptData(sample, password);
    const parsed = JSON.parse(bundle);
    const buf = Uint8Array.from(atob(parsed.encryptedData), (c) =>
      c.charCodeAt(0)
    );
    buf[0] ^= 0xff; // flip a bit
    parsed.encryptedData = btoa(String.fromCharCode(...buf));
    const tampered = JSON.stringify(parsed);

    await expect(decryptData(tampered, password)).rejects.toThrow(
      /Failed to decrypt data/
    );
  });

  test("produce different bundles for same input (unique salt+iv)", async () => {
    const b1 = await encryptData(sample, password);
    const b2 = await encryptData(sample, password);
    expect(b1).not.toEqual(b2);
  });

  test("handle very large payloads", async () => {
    const large = "A".repeat(100_000);
    const bundle = await encryptData(large, password);
    const decrypted = await decryptData(bundle, password);
    expect(decrypted).toBe(large);
    expect(decrypted).toHaveLength(100_000);
  });
});
