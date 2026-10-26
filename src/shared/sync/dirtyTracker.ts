import { platform } from '../platform';

const DIRTY_KEY = 'cloud.dirty';

export interface DirtyState {
  at: number;
  seq: number;
  tables: Record<string, number>;
}

let suspended = false;
let seq = 0;
let tables: Record<string, number> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  flushTimer = null;
  if (suspended) return;
  const state: DirtyState = { at: Date.now(), seq, tables: { ...tables } };
  void platform.storage.local.set({ [DIRTY_KEY]: state }).catch(() => {});
}

export function markDirty(table: string): void {
  if (suspended) return;
  seq += 1;
  tables[table] = Date.now();
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 150);
}

export async function flushDirtyNow(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (seq > 0 && !suspended) {
    await platform.storage.local.set({
      [DIRTY_KEY]: { at: Date.now(), seq, tables: { ...tables } },
    });
  }
}

export async function readDirty(): Promise<DirtyState | null> {
  const result = await platform.storage.local.get(DIRTY_KEY);
  const raw = result[DIRTY_KEY] as Partial<DirtyState> | undefined;
  if (!raw) return null;
  return {
    at: typeof raw.at === 'number' ? raw.at : 0,
    seq: typeof raw.seq === 'number' ? raw.seq : 0,
    tables: raw.tables ?? {},
  };
}

export async function clearDirty(onlyIfSeq?: number): Promise<void> {
  if (onlyIfSeq !== undefined) {
    const current = await readDirty();
    if (current && current.seq !== onlyIfSeq) return;
  }
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  seq = 0;
  tables = {};
  await platform.storage.local.remove(DIRTY_KEY);
}

export async function withDirtyTrackingSuspended<T>(fn: () => Promise<T>): Promise<T> {
  const previous = suspended;
  suspended = true;
  try {
    return await fn();
  } finally {
    suspended = previous;
  }
}
