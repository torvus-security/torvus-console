import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function getKey(): Buffer {
  const key = process.env.TORVUS_KMS_KEY;
  if (!key) {
    throw new Error('TORVUS_KMS_KEY is not configured');
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(key, 'base64');
  } catch (error) {
    throw new Error('TORVUS_KMS_KEY is not valid base64');
  }

  if (decoded.length !== 32) {
    throw new Error('TORVUS_KMS_KEY must decode to 32 bytes for AES-256-GCM');
  }

  return decoded;
}

function normaliseAad(aad?: string): Buffer | null {
  if (!aad) {
    return null;
  }
  const trimmed = aad.trim();
  return trimmed ? Buffer.from(trimmed, 'utf8') : null;
}

export function encrypt(plaintext: string, aad?: string): { ciphertext: Buffer; iv: Buffer } {
  if (typeof plaintext !== 'string') {
    throw new Error('encrypt() requires plaintext string');
  }

  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const aadBuffer = normaliseAad(aad);
  if (aadBuffer) {
    cipher.setAAD(aadBuffer);
  }

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([encrypted, authTag]), iv };
}

export function decrypt(ciphertext: Buffer, iv: Buffer, aad?: string): string {
  if (!Buffer.isBuffer(ciphertext) || ciphertext.length < 17) {
    throw new Error('decrypt() requires ciphertext with auth tag');
  }
  if (!Buffer.isBuffer(iv) || iv.length < 12) {
    throw new Error('decrypt() requires 12 byte iv');
  }

  const key = getKey();
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  const aadBuffer = normaliseAad(aad);
  if (aadBuffer) {
    decipher.setAAD(aadBuffer);
  }
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function generateIv(): Buffer {
  return randomBytes(12);
}
