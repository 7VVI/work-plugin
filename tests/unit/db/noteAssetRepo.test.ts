import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { noteAssetRepo, bufferToBase64, base64ToBuffer, readBlob } from '../../../src/shared/db/repositories/noteAssetRepo';

function pngBlob(bytes = 8): Blob {
  return new Blob([new Uint8Array(bytes).fill(7)], { type: 'image/png' });
}

function readAsBytes(blob: Blob): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve([...new Uint8Array(reader.result as ArrayBuffer)]);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('note asset repository', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('stores an image and reuses the same resource for identical content', async () => {
    const first = await noteAssetRepo.save(pngBlob(), 'image/png');
    const second = await noteAssetRepo.save(pngBlob(), 'image/png');

    expect(first.id).toBe(second.id);
    expect(first.hash).toHaveLength(64);
    expect((await db.noteAssets.count())).toBe(1);
  });

  it('rejects non-image files and oversized images', async () => {
    await expect(noteAssetRepo.save(new Blob(['x'], { type: 'text/plain' }), 'text/plain'))
      .rejects.toThrow('只支持图片文件');

    const huge = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/png' });
    await expect(noteAssetRepo.save(huge, 'image/png')).rejects.toThrow('上限');
  });

  it('round-trips binary data through base64', async () => {
    const blob = pngBlob(16);
    const base64 = bufferToBase64(await readBlob(blob));
    const restored = base64ToBuffer(base64);

    expect(restored.byteLength).toBe(blob.size);
    expect([...new Uint8Array(restored)]).toEqual(await readAsBytes(blob));
  });

  it('removes assets by id', async () => {
    const asset = await noteAssetRepo.save(pngBlob(), 'image/png');
    await noteAssetRepo.remove([asset.id]);
    expect((await db.noteAssets.count())).toBe(0);
  });
});
