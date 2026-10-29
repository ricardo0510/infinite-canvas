import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { ApiException } from "../common/api-exception";
import { SecretCipher, credentialAad } from "./secret-cipher";

function createCipher(secret = "test-master-secret") {
  return new SecretCipher({
    get: (key: string) => (key === "KEY_ENCRYPTION_SECRET" ? secret : undefined),
  } as ConfigService);
}

describe("SecretCipher", () => {
  it("encrypts and decrypts with the same aad", () => {
    const cipher = createCipher();
    const aad = credentialAad("user-1", "deepseek", "cred-1");
    const encrypted = cipher.encrypt("sk-1234567890abcd", aad);

    expect(encrypted.ciphertext).not.toContain("sk-");
    expect(cipher.decrypt(encrypted, aad)).toBe("sk-1234567890abcd");
  });

  it("rejects a different aad", () => {
    const cipher = createCipher();
    const encrypted = cipher.encrypt(
      "sk-1234567890abcd",
      credentialAad("user-1", "deepseek", "cred-1"),
    );

    expect(() =>
      cipher.decrypt(encrypted, credentialAad("user-2", "deepseek", "cred-1")),
    ).toThrow(ApiException);
  });

  it("rejects a tampered ciphertext", () => {
    const cipher = createCipher();
    const aad = credentialAad("user-1", "deepseek", "cred-1");
    const encrypted = cipher.encrypt("sk-1234567890abcd", aad);
    const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` };

    expect(() => cipher.decrypt(tampered, aad)).toThrow(ApiException);
  });

  it("fails when the master secret is missing", () => {
    const cipher = new SecretCipher({ get: () => undefined } as unknown as ConfigService);

    expect(() => cipher.encrypt("sk-test", "aad")).toThrow(ApiException);
  });

  it("masks keys without exposing the middle", () => {
    const cipher = createCipher();

    expect(cipher.mask("sk-1234567890abcd")).toBe("sk-...abcd");
    expect(cipher.mask("short")).toBe("sh...rt");
  });
});
