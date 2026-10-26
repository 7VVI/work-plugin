import { normalizeData, normalizeSnapshot, normalizeTombstones } from './normalize';
import type { SnapshotData, SyncSnapshot, TombstoneMap } from './types';

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const child = source[key];
      if (child !== undefined) result[key] = sortDeep(child);
    }
    return result;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('Cannot canonicalize non-finite number');
  }
  return value;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function computeStateHash(data: SnapshotData, tombstones: TombstoneMap): Promise<string> {
  return sha256Hex(canonicalize({
    data: normalizeData(data),
    tombstones: normalizeTombstones(tombstones),
  }));
}

export async function computeSnapshotHash(snapshot: SyncSnapshot, tombstones: TombstoneMap): Promise<string> {
  return computeStateHash(normalizeSnapshot(snapshot).data, tombstones);
}
