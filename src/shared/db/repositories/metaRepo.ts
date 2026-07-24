import { db } from '../schema';
import { toPlain } from '../../utils/plain';

export const metaRepo = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const row = await db.meta.get(key);
    return row?.value as T | undefined;
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value: toPlain(value) });
  },

  async remove(key: string): Promise<void> {
    await db.meta.delete(key);
  },
};
