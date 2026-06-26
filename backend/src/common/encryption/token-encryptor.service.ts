import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

let encryptionKey: Buffer;

function getKey(): Buffer {
  if (!encryptionKey) {
    const secret = process.env.TOKEN_ENCRYPTION_SECRET;
    if (!secret) {
      throw new Error(
        'TOKEN_ENCRYPTION_SECRET environment variable is missing or undefined.',
      );
    }
    encryptionKey = createHash('sha256').update(secret).digest();
  }
  return encryptionKey;
}

export function encryptToken(rawToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(rawToken, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptToken(payload: string): string {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);

  return (
    decipher.update(encrypted, undefined, 'utf-8') + decipher.final('utf8')
  );
}
