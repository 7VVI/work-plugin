import { middlewareRepo } from '../db/repositories/middlewareRepo';
import { middlewareTagRepo } from '../db/repositories/middlewareTagRepo';
import { cryptoService } from './cryptoService';
import type { Middleware, MiddlewareInput } from '../types/entities';
import { requireString, requireNumber } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';

export const middlewareService = {
  async all(): Promise<Middleware[]> {
    return middlewareRepo.all();
  },

  async byId(id: string): Promise<Middleware | undefined> {
    return middlewareRepo.byId(id);
  },

  async create(input: MiddlewareInput): Promise<string> {
    requireString(input.type, '类型');
    requireString(input.name, '名称');
    requireString(input.host, 'Host');
    requireNumber(input.port, '端口');
    const encryptedPassword = input.password ? await cryptoService.encryptField(input.password) : undefined;
    return middlewareRepo.create({
      type: input.type,
      name: input.name,
      version: input.version,
      host: input.host,
      port: input.port,
      database: input.database,
      username: input.username,
      password: encryptedPassword,
      extra: input.extra,
      remark: input.remark,
      favorite: input.favorite,
    });
  },

  async update(id: string, patch: Partial<MiddlewareInput>): Promise<void> {
    const { password, ...rest } = patch;
    const updatePatch: Partial<Middleware> = { ...rest };
    if (password !== undefined) {
      updatePatch.password = await cryptoService.encryptField(password);
    }
    await middlewareRepo.update(id, updatePatch);
  },

  async delete(id: string): Promise<void> {
    await middlewareRepo.delete(id);
  },

  async toggleFavorite(id: string): Promise<void> {
    const mw = await middlewareRepo.byId(id);
    if (!mw) return;
    await middlewareRepo.update(id, { favorite: !mw.favorite });
  },

  async copyConnectionString(id: string): Promise<void> {
    const mw = await middlewareRepo.byId(id);
    if (!mw) return;
    let conn = '';
    if (mw.type === 'redis') {
      conn = `redis://${mw.username ? `${mw.username}@` : ''}${mw.host}:${mw.port}/${mw.database ?? '0'}`;
    } else if (mw.type === 'mysql') {
      conn = `mysql://${mw.username}@${mw.host}:${mw.port}/${mw.database ?? ''}`;
    } else {
      conn = `${mw.host}:${mw.port}`;
    }
    await copyToClipboard(conn);
  },

  async copyPassword(id: string): Promise<void> {
    const mw = await middlewareRepo.byId(id);
    if (!mw?.password) return;
    const plain = await cryptoService.decryptField(mw.password);
    await copyToClipboard(plain);
  },

  async setTags(middlewareId: string, tagIds: string[]): Promise<void> {
    await middlewareTagRepo.replaceAll(middlewareId, tagIds);
  },

  async getTags(middlewareId: string): Promise<string[]> {
    return middlewareTagRepo.tagsFor(middlewareId);
  },

  async search(query: string): Promise<Middleware[]> {
    return middlewareRepo.search(query);
  },
};
