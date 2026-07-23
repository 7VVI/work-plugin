import { describe, it, expect } from 'vitest';
import { dockPathFor, subtitleFor } from '../../../src/dashboard/utils/dockPath';

describe('dockPathFor', () => {
  it('maps known routes to dock:// paths', () => {
    expect(dockPathFor('/systems')).toBe('dock://systems');
    expect(dockPathFor('/servers')).toBe('dock://servers');
    expect(dockPathFor('/middlewares')).toBe('dock://middleware');
    expect(dockPathFor('/configs')).toBe('dock://configs');
    expect(dockPathFor('/settings')).toBe('dock://settings');
  });
  it('falls back to dock://app for unknown routes', () => {
    expect(dockPathFor('/nope')).toBe('dock://app');
    expect(dockPathFor('')).toBe('dock://app');
  });
});

describe('subtitleFor', () => {
  const stats = { systems: 3, servers: 2, middlewares: 1, projects: 4, configs: 7, fields: 12 };
  it('returns systems subtitle with counts', () => {
    expect(subtitleFor('/systems', stats)).toBe('共 3 个系统');
  });
  it('returns servers subtitle', () => {
    expect(subtitleFor('/servers', stats)).toBe('共 2 台服务器');
  });
  it('returns configs subtitle with project/config/field counts', () => {
    expect(subtitleFor('/configs', stats)).toBe('4 个项目 · 7 个配置 · 12 个字段');
  });
  it('returns a generic subtitle for unknown routes', () => {
    expect(subtitleFor('/settings', stats)).toBe('外观 · 安全 · 快捷键 · 关于');
  });
});
