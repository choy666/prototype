import crypto from 'node:crypto';

function getEncryptionKey(): Buffer {
  const rawKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY no configurado');
  }

  const key = rawKey.trim();

  const isHex = /^[0-9a-fA-F]+$/.test(key) && key.length % 2 === 0;
  const buf = isHex ? Buffer.from(key, 'hex') : Buffer.from(key, 'base64');

  if (buf.length !== 32) {
    throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY debe ser 32 bytes (hex o base64)');
  }

  return buf;
}

export function encryptString(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptString(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split('.');

  if (parts.length !== 3) {
    throw new Error('Formato de cifrado inválido');
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
