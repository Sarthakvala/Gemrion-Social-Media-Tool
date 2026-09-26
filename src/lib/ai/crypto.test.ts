import { describe, expect, test } from 'vitest';
import { decryptSecret, encryptSecret, keyHint } from './crypto';

const SECRET = 'service-role-secret-for-tests';

describe('encryptSecret / decryptSecret', () => {
  test('round-trips', () => {
    const sealed = encryptSecret('sk-ant-api03-abc123', SECRET);
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('abc123');
    expect(decryptSecret(sealed, SECRET)).toBe('sk-ant-api03-abc123');
  });

  test('uses a fresh IV every time', () => {
    expect(encryptSecret('same', SECRET)).not.toBe(encryptSecret('same', SECRET));
  });

  test('empty input decrypts to empty string', () => {
    expect(decryptSecret('', SECRET)).toBe('');
  });

  test('a different secret cannot decrypt', () => {
    const sealed = encryptSecret('sk-test', SECRET);
    expect(() => decryptSecret(sealed, 'other-secret')).toThrow();
  });

  test('tampering is detected', () => {
    const [v, iv, tag, body] = encryptSecret('sk-test-value', SECRET).split('.');
    // flip the first char: the last base64 char can carry only padding bits
    const flipped = (body.startsWith('A') ? 'B' : 'A') + body.slice(1);
    expect(() => decryptSecret([v, iv, tag, flipped].join('.'), SECRET)).toThrow();
  });

  test('rejects unknown formats and a missing secret', () => {
    expect(() => decryptSecret('plain-text', SECRET)).toThrow();
    expect(() => encryptSecret('x', '')).toThrow();
  });
});

describe('keyHint', () => {
  test('shows only the prefix and last four', () => {
    expect(keyHint('sk-ant-api03-SECRETSECRET-wxyz')).toBe('sk-ant…wxyz');
  });

  test('hides short values entirely', () => {
    expect(keyHint('short')).toBe('••••');
  });
});
