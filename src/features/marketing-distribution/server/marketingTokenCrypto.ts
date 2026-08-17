import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedMarketingToken = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

const readKey = (encodedKey: string): Buffer => {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error('CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
};

export const encryptMarketingToken = (
  token: string,
  encodedKey = process.env.CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY ?? '',
): EncryptedMarketingToken => {
  if (!token) throw new Error('A provider token is required.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', readKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
};

export const decryptMarketingToken = (
  encrypted: EncryptedMarketingToken,
  encodedKey = process.env.CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY ?? '',
): string => {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    readKey(encodedKey),
    Buffer.from(encrypted.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};
