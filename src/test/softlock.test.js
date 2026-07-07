import { describe, test, expect } from 'vitest';
import { SOFT_LOCK_LENGTH } from '../lib/constants';

async function hashSequence(sequence) {
  const encoder = new TextEncoder();
  const data = encoder.encode(sequence.join('-'));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('Soft-Lock', () => {
  test('sequence length constant is exactly 3', () => {
    expect(SOFT_LOCK_LENGTH).toBe(3);
  });

  test('SHA-256 hash of sequence is deterministic', async () => {
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown'];
    const hash1 = await hashSequence(seq);
    const hash2 = await hashSequence(seq);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  test('different sequences produce different hashes', async () => {
    const hash1 = await hashSequence(['ArrowUp', 'ArrowUp', 'ArrowDown']);
    const hash2 = await hashSequence(['ArrowDown', 'ArrowUp', 'ArrowUp']);
    expect(hash1).not.toBe(hash2);
  });

  test('hash is a valid hex string', async () => {
    const hash = await hashSequence(['ArrowLeft', 'ArrowRight', 'ArrowUp']);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('order matters for hashing', async () => {
    const hash1 = await hashSequence(['ArrowUp', 'ArrowDown', 'ArrowLeft']);
    const hash2 = await hashSequence(['ArrowUp', 'ArrowLeft', 'ArrowDown']);
    expect(hash1).not.toBe(hash2);
  });

  test('all four arrow keys produce valid hashes', async () => {
    const sequences = [
      ['ArrowUp', 'ArrowDown', 'ArrowLeft'],
      ['ArrowRight', 'ArrowRight', 'ArrowRight'],
      ['ArrowDown', 'ArrowLeft', 'ArrowUp'],
    ];
    for (const seq of sequences) {
      const hash = await hashSequence(seq);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
