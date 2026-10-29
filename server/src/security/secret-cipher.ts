import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiException } from "../common/api-exception";

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const CURRENT_KEY_VERSION = 1;
const KDF_SALT = "infinite-canvas/byok/kek/v1";

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  wrappedKey: string;
  keyIv: string;
  keyTag: string;
};

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

@Injectable()
export class SecretCipher {
  private readonly kek: Buffer | null;

  constructor(config: ConfigService) {
    const secret = config.get<string>("KEY_ENCRYPTION_SECRET")?.trim();
    this.kek = secret ? scryptSync(secret, KDF_SALT, KEY_LENGTH) : null;
  }

  isConfigured(): boolean {
    return this.kek !== null;
  }

  encrypt(plain: string, aad: string): EncryptedSecret {
    const kek = this.requireKek();
    const dek = randomBytes(KEY_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", dek, iv);
    cipher.setAAD(Buffer.from(aad, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const keyIv = randomBytes(IV_LENGTH);
    const wrapping = createCipheriv("aes-256-gcm", kek, keyIv);
    wrapping.setAAD(Buffer.from(aad, "utf8"));
    const wrappedKey = Buffer.concat([wrapping.update(dek), wrapping.final()]);
    const keyTag = wrapping.getAuthTag();

    return {
      ciphertext: encode(ciphertext),
      iv: encode(iv),
      authTag: encode(authTag),
      keyVersion: CURRENT_KEY_VERSION,
      wrappedKey: encode(wrappedKey),
      keyIv: encode(keyIv),
      keyTag: encode(keyTag),
    };
  }

  decrypt(secret: EncryptedSecret, aad: string): string {
    const kek = this.requireKek();
    if (secret.keyVersion !== CURRENT_KEY_VERSION) {
      throw new ApiException(50000, "凭据解密失败", 500);
    }

    try {
      const unwrapping = createDecipheriv("aes-256-gcm", kek, decode(secret.keyIv));
      unwrapping.setAAD(Buffer.from(aad, "utf8"));
      unwrapping.setAuthTag(decode(secret.keyTag));
      const dek = Buffer.concat([unwrapping.update(decode(secret.wrappedKey)), unwrapping.final()]);

      const decipher = createDecipheriv("aes-256-gcm", dek, decode(secret.iv));
      decipher.setAAD(Buffer.from(aad, "utf8"));
      decipher.setAuthTag(decode(secret.authTag));
      return Buffer.concat([decipher.update(decode(secret.ciphertext)), decipher.final()]).toString(
        "utf8",
      );
    } catch {
      throw new ApiException(50000, "凭据解密失败", 500);
    }
  }

  mask(plain: string): string {
    const value = plain.trim();
    if (!value) return "";
    if (value.length <= 8) {
      const head = value.slice(0, 2);
      const tail = value.slice(-2);
      return `${head}...${tail}`;
    }
    return `${value.slice(0, 3)}...${value.slice(-4)}`;
  }

  serialize(secret: EncryptedSecret): string {
    return JSON.stringify(secret);
  }

  parse(value: string): EncryptedSecret {
    try {
      return JSON.parse(value) as EncryptedSecret;
    } catch {
      throw new ApiException(50000, "凭据解密失败", 500);
    }
  }

  private requireKek(): Buffer {
    if (!this.kek) {
      throw new ApiException(50000, "服务端未配置 KEY_ENCRYPTION_SECRET", 500);
    }
    return this.kek;
  }
}

export function credentialAad(userId: string, providerId: string, credentialId: string): string {
  return `${userId}:${providerId}:${credentialId}`;
}
