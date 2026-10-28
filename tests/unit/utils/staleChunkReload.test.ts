import { describe, it, expect } from 'vitest';
import { isStaleChunkError } from '../../../src/shared/utils/staleChunkReload';

describe('stale chunk detection', () => {
  it('matches vite dynamic import failures', () => {
    expect(isStaleChunkError(
      new TypeError('Failed to fetch dynamically imported module: chrome-extension://abc/assets/chunk-r1SEQbWN.js'),
    )).toBe(true);
    expect(isStaleChunkError('Error: Importing a module script failed.')).toBe(true);
    expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isStaleChunkError(new Error('TextSelection endpoint not pointing into a node with inline content (doc)'))).toBe(false);
    expect(isStaleChunkError('Failed to fetch')).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });
});
