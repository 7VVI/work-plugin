import { systemRepo } from '../db/repositories/systemRepo';
import { serverRepo } from '../db/repositories/serverRepo';
import { middlewareRepo } from '../db/repositories/middlewareRepo';
import type { EntityType } from '../types/entities';

export interface SearchResult {
  type: EntityType | 'account';
  id: string;
  title: string;
  subtitle: string;
  matchedField: string;
  favorite?: boolean;
}

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const [systems, servers, middlewares] = await Promise.all([
      systemRepo.search(q),
      serverRepo.search(q),
      middlewareRepo.search(q),
    ]);

    const results: SearchResult[] = [];

    for (const s of systems) {
      results.push({
        type: 'system',
        id: s.id,
        title: s.name,
        subtitle: s.url,
        matchedField: findMatchedField(q, { name: s.name, url: s.url, remark: s.remark }),
        favorite: s.favorite,
      });
    }

    for (const s of servers) {
      results.push({
        type: 'server',
        id: s.id,
        title: s.name,
        subtitle: `${s.ip}:${s.sshPort}`,
        matchedField: findMatchedField(q, { name: s.name, ip: s.ip, remark: s.remark }),
        favorite: s.favorite,
      });
    }

    for (const m of middlewares) {
      results.push({
        type: 'middleware',
        id: m.id,
        title: m.name,
        subtitle: `${m.host}:${m.port}`,
        matchedField: findMatchedField(q, { name: m.name, host: m.host, remark: m.remark }),
        favorite: m.favorite,
      });
    }

    return this.rankResults(results);
  },

  rankResults(results: SearchResult[]): SearchResult[] {
    return results.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.title.localeCompare(b.title);
    });
  },
};

function findMatchedField(q: string, fields: Record<string, string | undefined>): string {
  for (const [key, value] of Object.entries(fields)) {
    if (value && value.toLowerCase().includes(q)) return key;
  }
  return 'name';
}
