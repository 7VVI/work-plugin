import { describe, it, expect } from 'vitest';
import { buildSystemSearchSections } from '../../../src/popup/utils/systemSearch';
import type { Group, System } from '../../../src/shared/types/entities';

interface SystemOptions {
  url?: string;
  favorite?: boolean;
  sort?: number;
  groupId?: string;
}

function system(id: string, name: string, options: SystemOptions = {}): System {
  return {
    id,
    name,
    url: options.url ?? `https://${id}.example.com`,
    environment: 'development',
    favorite: options.favorite ?? false,
    sort: options.sort ?? 0,
    groupId: options.groupId,
    createdAt: 0,
    updatedAt: 0,
  };
}

function group(id: string, name: string, sortOrder = 0): Group {
  return {
    id,
    entityType: 'system',
    name,
    color: '#2E6BF0',
    sortOrder,
    createdAt: sortOrder,
    updatedAt: sortOrder,
  };
}

describe('buildSystemSearchSections', () => {
  it('无搜索词时保持常用与全部系统分组', () => {
    const sections = buildSystemSearchSections(
      [
        system('s1', 'A', { favorite: true, sort: 1 }),
        system('s2', 'B', { sort: 0 }),
        system('s3', 'C', { favorite: true, sort: 2 }),
      ],
      [],
      '',
    );

    // 「全部系统」分组不重复标题（弹窗顶部已有），只保留「常用」
    expect(sections.map(s => s.label)).toEqual(['常用', '']);
    expect(sections[0].systems.map(s => s.id)).toEqual(['s1', 's3']);
    expect(sections[1].systems.map(s => s.id)).toEqual(['s2']);
  });

  it('系统名称/URL 直接命中的结果仍然排在前面', () => {
    const sections = buildSystemSearchSections(
      [
        system('s1', 'Jenkins', { favorite: true }),
        system('s2', 'Jenkins (CORS)'),
        system('s3', 'Other', { url: 'https://jenkins.example.com' }),
      ],
      [],
      'jenkins',
    );

    expect(sections.map(s => s.label)).toEqual(['常用', '']);
    expect(sections[0].systems.map(s => s.id)).toEqual(['s1']);
    expect(sections[1].systems.map(s => s.id)).toEqual(['s2', 's3']);
  });

  it('分组名称命中的系统追加在直接命中结果之后', () => {
    const sections = buildSystemSearchSections(
      [
        system('s1', 'Jenkins CORS', { groupId: 'g1' }),
        system('s2', 'Nacos', { groupId: 'g1' }),
        system('s3', 'Unrelated', { groupId: 'g2' }),
      ],
      [group('g1', 'CORS 国内'), group('g2', '其他')],
      'cors',
    );

    expect(sections.map(s => s.label)).toEqual(['', '分组 · CORS 国内']);
    expect(sections[0].systems.map(s => s.id)).toEqual(['s1']);
    expect(sections[1].systems.map(s => s.id)).toEqual(['s2']);
    expect(sections[1].color).toBe('#2E6BF0');
  });

  it('直接命中的系统不会在分组结果中重复出现', () => {
    const sections = buildSystemSearchSections(
      [system('s1', 'Nacos', { groupId: 'g1' })],
      [group('g1', 'Nacos 集群')],
      'nacos',
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('');
    expect(sections[0].systems.map(s => s.id)).toEqual(['s1']);
  });

  it('只命中分组名时仅返回分组结果，并按分组顺序排列', () => {
    const sections = buildSystemSearchSections(
      [
        system('s1', 'A', { groupId: 'g2', sort: 0 }),
        system('s2', 'B', { groupId: 'g1', sort: 1 }),
        system('s3', 'C', { groupId: 'g1', sort: 0 }),
      ],
      [group('g2', 'CORS 国际', 1), group('g1', 'CORS 国内', 0)],
      'cors',
    );

    expect(sections.map(s => s.label)).toEqual(['分组 · CORS 国内', '分组 · CORS 国际']);
    expect(sections[0].systems.map(s => s.id)).toEqual(['s3', 's2']);
    expect(sections[1].systems.map(s => s.id)).toEqual(['s1']);
  });

  it('搜索词为空或只有空格时不做分组匹配', () => {
    const sections = buildSystemSearchSections(
      [system('s1', 'A', { groupId: 'g1' })],
      [group('g1', 'CORS')],
      '   ',
    );
    expect(sections.map(s => s.label)).toEqual(['']);
  });

  it('按环境多选过滤系统', () => {
    const prod = { ...system('s1', 'Prod'), environment: 'production' as const };
    const dev = { ...system('s2', 'Dev'), environment: 'development' as const };
    const test = { ...system('s3', 'Test'), environment: 'test' as const };

    const onlyProd = buildSystemSearchSections([prod, dev, test], [], '', ['production']);
    expect(onlyProd.flatMap(s => s.systems).map(s => s.id)).toEqual(['s1']);

    const prodAndTest = buildSystemSearchSections([prod, dev, test], [], '', ['production', 'test']);
    expect(prodAndTest.flatMap(s => s.systems).map(s => s.id)).toEqual(['s1', 's3']);

    // 不传环境＝不过滤
    const all = buildSystemSearchSections([prod, dev, test], [], '');
    expect(all.flatMap(s => s.systems)).toHaveLength(3);
  });

  it('环境过滤与关键字搜索同时生效', () => {
    const prod = { ...system('s1', 'Nacos 生产'), environment: 'production' as const };
    const dev = { ...system('s2', 'Nacos 开发'), environment: 'development' as const };
    const sections = buildSystemSearchSections([prod, dev], [], 'nacos', ['development']);
    expect(sections.flatMap(s => s.systems).map(s => s.id)).toEqual(['s2']);
  });
});
