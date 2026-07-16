import { serverRepo } from '../db/repositories/serverRepo';
import { serverTagRepo } from '../db/repositories/serverTagRepo';
import { cryptoService } from './cryptoService';
import type { Server, ServerInput } from '../types/entities';
import { requireString, requireNumber } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';

export const serverService = {
  async all(): Promise<Server[]> {
    return serverRepo.all();
  },

  async byId(id: string): Promise<Server | undefined> {
    return serverRepo.byId(id);
  },

  async create(input: ServerInput): Promise<string> {
    requireString(input.name, '名称');
    requireString(input.ip, 'IP');
    requireNumber(input.sshPort, 'SSH 端口');
    requireString(input.username, '账号');
    const encryptedPassword = await cryptoService.encryptField(input.password);
    const encryptedSshKey = input.sshKey ? await cryptoService.encryptField(input.sshKey) : undefined;
    return serverRepo.create({
      name: input.name,
      ip: input.ip,
      sshPort: input.sshPort,
      username: input.username,
      password: encryptedPassword,
      sshKey: encryptedSshKey,
      environment: input.environment,
      status: input.status,
      purpose: input.purpose,
      remark: input.remark,
      favorite: input.favorite,
    });
  },

  async update(id: string, patch: Partial<ServerInput>): Promise<void> {
    const { password, sshKey, ...rest } = patch;
    const updatePatch: Partial<Server> = { ...rest };
    if (password !== undefined) {
      updatePatch.password = await cryptoService.encryptField(password);
    }
    if (sshKey !== undefined) {
      updatePatch.sshKey = await cryptoService.encryptField(sshKey);
    }
    await serverRepo.update(id, updatePatch);
  },

  async delete(id: string): Promise<void> {
    await serverRepo.delete(id);
  },

  async toggleFavorite(id: string): Promise<void> {
    const server = await serverRepo.byId(id);
    if (!server) return;
    await serverRepo.update(id, { favorite: !server.favorite });
  },

  async copyIp(id: string): Promise<void> {
    const server = await serverRepo.byId(id);
    if (server) await copyToClipboard(server.ip);
  },

  async copySshCommand(id: string): Promise<void> {
    const server = await serverRepo.byId(id);
    if (!server) return;
    await copyToClipboard(`ssh ${server.username}@${server.ip} -p ${server.sshPort}`);
  },

  async copyPassword(id: string): Promise<void> {
    const server = await serverRepo.byId(id);
    if (!server) return;
    const plain = await cryptoService.decryptField(server.password);
    await copyToClipboard(plain);
  },

  async setTags(serverId: string, tagIds: string[]): Promise<void> {
    await serverTagRepo.replaceAll(serverId, tagIds);
  },

  async getTags(serverId: string): Promise<string[]> {
    return serverTagRepo.tagsFor(serverId);
  },

  async search(query: string): Promise<Server[]> {
    return serverRepo.search(query);
  },
};
