import { describe, it, expect } from 'vitest';
import {
  ASSET_REF_PREFIX,
  assetRef,
  collectAssetRefs,
  isAssetRef,
  parseAssetRef,
} from '../../../src/shared/utils/noteAssets';

describe('note asset references', () => {
  it('builds and parses references', () => {
    const ref = assetRef('ast_123');
    expect(ref).toBe(`${ASSET_REF_PREFIX}ast_123`);
    expect(isAssetRef(ref)).toBe(true);
    expect(isAssetRef('https://example.com/a.png')).toBe(false);
    expect(parseAssetRef(ref)).toBe('ast_123');
    expect(parseAssetRef('https://example.com/a.png')).toBeNull();
  });

  it('collects referenced ids from markdown', () => {
    const markdown = [
      '段落 ![甲](dock-asset:ast_a) 文字',
      '![乙](dock-asset:ast_b)',
      '![重复](dock-asset:ast_a)',
      '![外链](https://example.com/a.png)',
    ].join('\n');

    expect(collectAssetRefs(markdown).sort()).toEqual(['ast_a', 'ast_b']);
  });

  it('returns no ids for markdown without assets', () => {
    expect(collectAssetRefs('纯文本 ![](https://example.com/a.png)')).toEqual([]);
  });
});
