import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const INFO = 'agencyflow/ai-settings/v1';

function key(secret: string): Buffer {
  if (!secret) throw new Error('Encryption secret is missing.');
  return Buffer.from(hkdfSync('sha256', secret, 'agencyflow', INFO, 32));
}

/** AES-256-GCM. Output: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

/** Returns '' for empty input; throws if the value was tampered with or the secret changed. */
export function decryptSecret(sealed: string, secret: string): string {
  if (!sealed) return '';
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || body === undefined) throw new Error('Unrecognised encrypted value.');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}

/** "sk-...abcd" style hint so the UI can show which key is saved without revealing it. */
export function keyHint(plain: string): string {
  const t = plain.trim();
  if (t.length < 12) return '••••';
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}
