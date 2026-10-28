import { describe, it, expect } from 'vitest';
import { renderNoteHtml } from '../../../src/shared/utils/noteHtmlExport';

describe('note html export', () => {
  it('renders markdown into a standalone html document', async () => {
    const html = await renderNoteHtml('# 标题\n\n正文 **加粗**\n\n```js\nconst a = 1;\n```\n\n> 引用\n\n| a | b |\n| - | - |\n| 1 | 2 |', {
      title: '部署指南',
      bookName: '工作',
    });

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<title>部署指南</title>');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('language-js');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<table>');
    expect(html).toContain('工作');
  });

  it('keeps inline style tags and the siyuan color variables', async () => {
    const html = await renderNoteHtml(
      '<u>下划线</u> <mark>高亮</mark> <sup>2</sup> <sub>2</sub> <span style="color: var(--b3-font-color6)">蓝色</span>',
      { title: '样式' },
    );

    expect(html).toContain('<u>下划线</u>');
    expect(html).toContain('<mark>高亮</mark>');
    expect(html).toContain('<sup>2</sup>');
    expect(html).toContain('<sub>2</sub>');
    expect(html).toContain('color: var(--b3-font-color6)');
    expect(html).toContain('--b3-font-color6: #2563eb');
    expect(html).toContain('mark {');
  });

  it('escapes the title and keeps external images untouched', async () => {
    const html = await renderNoteHtml('![图](https://example.com/a.png)', {
      title: '<script>alert(1)</script>',
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('src="https://example.com/a.png"');
  });
});

describe('note html export sanitizing', () => {
  it('strips scripts and event handlers from raw html in the note', async () => {
    const html = await renderNoteHtml(
      '正文 <span style="color: red">红色</span>\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">',
      { title: '清洗' },
    );

    expect(html).toContain('红色');
    expect(html).toContain('color: red');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});
