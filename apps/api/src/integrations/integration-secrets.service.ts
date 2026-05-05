import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

type SecretEnvelopeV1 = `enc:v1:${string}:${string}:${string}`;
type SecretEnvelopeV2 = `enc:v2:${string}:${string}:${string}:${string}`;
type SecretEnvelope = SecretEnvelopeV1 | SecretEnvelopeV2;
type CurrentKey = {
  key: Buffer;
  keyId: string;
};
type DecodedSecretValue = {
  value: unknown;
  requiresMigration: boolean;
};

function normalizeRecord(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isEncryptedValue(value: unknown): value is SecretEnvelope {
  return typeof value === 'string' && (value.startsWith('enc:v1:') || value.startsWith('enc:v2:'));
}

@Injectable()
export class IntegrationSecretsService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyBytes = 32;

  private getKeyMaterial() {
    return (process.env.INTEGRATION_SECRET_KEY || '').trim();
  }

  private getPreviousKeyMaterials() {
    return (process.env.INTEGRATION_SECRET_KEY_PREVIOUS || '')
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private getLegacyKeyMaterials() {
    return (process.env.INTEGRATION_SECRET_LEGACY_KEYS || '')
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  isConfigured() {
    try {
      this.getCurrentKey();
      return true;
    } catch {
      return false;
    }
  }

  private getCurrentKey(): CurrentKey {
    const material = this.getKeyMaterial();
    if (!material) {
      throw new InternalServerErrorException(
        'INTEGRATION_SECRET_KEY is not configured.',
      );
    }

    const key = this.parseKeyMaterial(material);
    const keyId = createHash('sha256').update(key).digest('hex').slice(0, 16);
    return { key, keyId };
  }

  private getPreviousKeys() {
    return this.getPreviousKeyMaterials().map((material) => {
      const key = this.parseKeyMaterial(material);
      const keyId = createHash('sha256').update(key).digest('hex').slice(0, 16);
      return { key, keyId };
    });
  }

  private parseKeyMaterial(material: string) {
    if (/^[0-9a-f]{64}$/i.test(material)) {
      return Buffer.from(material, 'hex');
    }

    if (/^[A-Za-z0-9+/=_-]+$/.test(material)) {
      const normalized = material.replace(/-/g, '+').replace(/_/g, '/');
      const key = Buffer.from(normalized, 'base64');
      if (key.length === this.keyBytes) {
        return key;
      }
    }

    throw new InternalServerErrorException(
      'INTEGRATION_SECRET_KEY must be a 32-byte base64 value or 64-character hex value.',
    );
  }

  private getLegacyKeysV1() {
    const values = [this.getKeyMaterial(), ...this.getPreviousKeyMaterials(), ...this.getLegacyKeyMaterials()]
      .map((value) => value.trim())
      .filter(Boolean);

    const unique = new Set(values);
    return Array.from(unique).map((material) => ({
      material,
      key: createHash('sha256').update(material).digest(),
    }));
  }

  encryptRecord(values: Record<string, unknown>) {
    const input = normalizeRecord(values);
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(input)) {
      if (value === null || value === undefined) {
        continue;
      }

      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      if (!raw.trim()) {
        continue;
      }

      result[key] = this.encryptValue(raw);
    }

    return result;
  }

  decryptRecord(values: Record<string, unknown>, encrypted: boolean) {
    const input = normalizeRecord(values);
    if (!encrypted) {
      return input;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (!isEncryptedValue(value)) {
        continue;
      }

      result[key] = this.decryptValue(value);
    }

    return result;
  }

  inspectRecord(values: Record<string, unknown>, encrypted: boolean) {
    const input = normalizeRecord(values);
    const decrypted: Record<string, unknown> = {};
    let requiresMigration = false;

    if (!encrypted) {
      for (const [key, value] of Object.entries(input)) {
        if (value !== null && value !== undefined) {
          decrypted[key] = value;
        }
      }

      return {
        decrypted,
        requiresMigration: this.hasConfiguredSecrets(input),
      };
    }

    for (const [key, value] of Object.entries(input)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (isEncryptedValue(value)) {
        const decoded = this.decryptEnvelope(value);
        decrypted[key] = decoded.value;
        if (decoded.requiresMigration) {
          requiresMigration = true;
        }
        continue;
      }

      decrypted[key] = value;
      requiresMigration = true;
    }

    return { decrypted, requiresMigration };
  }

  hasConfiguredSecrets(values: Record<string, unknown>) {
    const input = normalizeRecord(values);
    return Object.values(input).some((value) => {
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }

      return value !== null && value !== undefined;
    });
  }

  private encryptValue(value: string) {
    const iv = randomBytes(12);
    const currentKey = this.getCurrentKey();
    const cipher = createCipheriv(this.algorithm, currentKey.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `enc:v2:${currentKey.keyId}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}` as SecretEnvelope;
  }

  private decryptValue(envelope: SecretEnvelope) {
    return this.decryptEnvelope(envelope).value;
  }

  private decryptEnvelope(envelope: SecretEnvelope): DecodedSecretValue {
    const parts = envelope.split(':');
    const version = parts[1];

    if (version === 'v2') {
      const [, , keyId, ivB64, tagB64, cipherB64] = parts;
      const keyring = [this.getCurrentKey(), ...this.getPreviousKeys()];
      const selected = keyring.find((entry) => entry.keyId === keyId);
      if (!selected) {
        throw new InternalServerErrorException(
          'Integration secret key does not match any configured key id.',
        );
      }

      const decipher = createDecipheriv(
        this.algorithm,
        selected.key,
        Buffer.from(ivB64, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      return {
        value: this.decodeDecryptedPayload(
          Buffer.concat([
            decipher.update(Buffer.from(cipherB64, 'base64')),
            decipher.final(),
          ]).toString('utf8'),
        ),
        requiresMigration: keyId !== this.getCurrentKey().keyId,
      };
    } else if (version === 'v1') {
      const [, , ivB64, tagB64, cipherB64] = parts;
      for (const legacy of this.getLegacyKeysV1()) {
        try {
          const decipher = createDecipheriv(
            this.algorithm,
            legacy.key,
            Buffer.from(ivB64, 'base64'),
          );
          decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
          const decrypted = Buffer.concat([
            decipher.update(Buffer.from(cipherB64, 'base64')),
            decipher.final(),
          ]).toString('utf8');

          return {
            value: this.decodeDecryptedPayload(decrypted),
            requiresMigration: true,
          };
        } catch {
          continue;
        }
      }

      throw new InternalServerErrorException('Unable to decrypt legacy integration secret.');
    } else {
      throw new InternalServerErrorException('Unsupported integration secret version.');
    }
  }

  private decodeDecryptedPayload(decrypted: string) {
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  }
}
