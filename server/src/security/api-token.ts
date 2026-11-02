import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "ic_";

/** Generates a new opaque bearer token. The raw value is shown only once. */
export function generateApiToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** Tokens are stored as SHA-256 hashes; the raw value never reaches the database. */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
