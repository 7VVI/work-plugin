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

  it('escapes the title and keeps external images untouched', async () => {
    const html = await renderNoteHtml('![图](https://example.com/a.png)', {
      title: '<script>alert(1)</script>',
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('src="https://example.com/a.png"');
  });
});
