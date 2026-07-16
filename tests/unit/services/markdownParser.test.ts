import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../../src/shared/services/markdownParser';
import { serializeMarkdown } from '../../../src/shared/services/markdownSerializer';

const SAMPLE = `---
navPortalVersion: 1
exportedAt: 2026-07-16T10:30:00.000Z
encrypted: false
passwordsIncluded: true
---

# Nav Portal Backup

## 系统

### Test System

- **URL**: https://test.example.com
- **环境**: production
- **标签**: tag1, tag2
- **备注**: Test remark

## 服务器

### Test Server

- **IP**: 10.0.0.1
- **SSH 端口**: 22
- **账号**: root
- **密码**: mypassword

## 标签

- tag1 (#3b82f6)
- tag2 (#ef4444)
`;

describe('markdownParser', () => {
  it('parses front-matter', () => {
    const result = parseMarkdown(SAMPLE);
    expect(result.meta.navPortalVersion).toBe(1);
    expect(result.meta.encrypted).toBe(false);
  });

  it('parses systems', () => {
    const result = parseMarkdown(SAMPLE);
    expect(result.systems).toHaveLength(1);
    expect(result.systems[0].name).toBe('Test System');
    expect(result.systems[0].url).toBe('https://test.example.com');
    expect(result.systems[0].environment).toBe('production');
  });

  it('parses servers', () => {
    const result = parseMarkdown(SAMPLE);
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0].ip).toBe('10.0.0.1');
    expect(result.servers[0].sshPort).toBe(22);
  });

  it('parses tags', () => {
    const result = parseMarkdown(SAMPLE);
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0].name).toBe('tag1');
    expect(result.tags[0].color).toBe('#3b82f6');
  });
});

describe('markdownSerializer', () => {
  it('round-trips parse(serialize(data)) back to same data', () => {
    const parsed = parseMarkdown(SAMPLE);
    const reserialized = serializeMarkdown(parsed, { includePasswords: true });
    const reparsed = parseMarkdown(reserialized);
    expect(reparsed.systems[0].name).toBe(parsed.systems[0].name);
    expect(reparsed.servers[0].ip).toBe(parsed.servers[0].ip);
    expect(reparsed.tags).toHaveLength(parsed.tags.length);
  });
});
