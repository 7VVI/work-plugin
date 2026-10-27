import { describe, it, expect } from 'vitest';
import {
  buildSearchSnippet,
  countNoteWords,
  extractOutline,
  markdownToPlainText,
  sanitizeFilename,
  utf8Bytes,
} from '../../../src/shared/utils/noteUtils';

describe('noteUtils', () => {
  it('extracts top-level headings and ignores fenced code', () => {
    const markdown = [
      '# 一级',
      '正文',
      '## 二级 ##',
      '```sh',
      '# 代码里的注释',
      '```',
      '> # 引用里的标题',
      '- # 列表里的标题',
      '### 三级',
    ].join('\n');

    expect(extractOutline(markdown)).toEqual([
      { level: 1, text: '一级', index: 0 },
      { level: 2, text: '二级', index: 1 },
      { level: 3, text: '三级', index: 2 },
    ]);
  });

  it('converts markdown to plain text for search and word count', () => {
    const text = markdownToPlainText('**粗体** 和 `code`，[链接](https://example.com)，![图](a.png)');
    expect(text).toContain('粗体');
    expect(text).toContain('链接');
    expect(text).toContain('图');
    expect(text).not.toContain('https://example.com');
    expect(text).not.toContain('a.png');
  });

  it('counts Chinese characters and English words', () => {
    expect(countNoteWords('你好 world，hello_2')).toBe(4);
    expect(countNoteWords('')).toBe(0);
  });

  it('sanitizes filenames and provides a fallback', () => {
    expect(sanitizeFilename('a/b:c*?"<>|')).toBe('a b c');
    expect(sanitizeFilename('   ')).toBe('未命名笔记');
  });

  it('builds a search snippet around the match', () => {
    const content = '前缀 '.repeat(20) + '目标关键词' + ' 后缀 '.repeat(20);
    const snippet = buildSearchSnippet(content, '目标关键词', 40);
    expect(snippet).toContain('目标关键词');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('computes utf8 byte length', () => {
    expect(utf8Bytes('abc')).toBe(3);
    expect(utf8Bytes('中文')).toBe(6);
  });
});
