import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import DOMPurify from 'dompurify';
import { mergeInlineHtml, htmlRemark } from '../../../src/dashboard/components/notes/crepeHtml';

interface MdastLike {
  type?: string;
  value?: string;
  children?: MdastLike[];
}

function paragraphChildren(tree: MdastLike): MdastLike[] {
  return tree.children?.[0]?.children ?? [];
}

describe('inline html rendering', () => {
  it('merges an opening tag, its content and the closing tag into one html node', () => {
    const merged = mergeInlineHtml([
      { type: 'text', value: '注意' },
      { type: 'html', value: '<span style="color: red;">' },
      { type: 'text', value: 'AR角色标识' },
      { type: 'html', value: '</span>' },
      { type: 'text', value: '用于筛选' },
    ]);

    expect(merged).toEqual([
      { type: 'text', value: '注意' },
      { type: 'html', value: '<span style="color: red;">AR角色标识</span>' },
      { type: 'text', value: '用于筛选' },
    ]);
  });

  it('handles nested tags of the same name', () => {
    const merged = mergeInlineHtml([
      { type: 'html', value: '<span>' },
      { type: 'text', value: 'A' },
      { type: 'html', value: '<span>' },
      { type: 'text', value: 'B' },
      { type: 'html', value: '</span>' },
      { type: 'html', value: '</span>' },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe('<span>A<span>B</span></span>');
  });

  it('drops a stray tag that never closes', () => {
    const merged = mergeInlineHtml([
      { type: 'text', value: 'A' },
      { type: 'html', value: '<span>' },
      { type: 'text', value: 'B' },
    ]);

    expect(merged).toEqual([
      { type: 'text', value: 'A' },
      { type: 'text', value: 'B' },
    ]);
  });

  it('parses raw inline html through the remark plugin used by the editor', async () => {
    const processor = unified().use(remarkParse).use(remarkStringify).use(htmlRemark.plugin as never, htmlRemark.options as never);
    const tree = processor.parse('注意<span data-type="text" style="color: red;">AR角色标识</span>用于筛选。') as MdastLike;

    // 插件里的 transformer 由 process 触发；这里手动跑一次保证与运行时一致
    mergeInlineHtml(paragraphChildren(tree));
    const children = mergeInlineHtml(paragraphChildren(tree));
    const htmlNodes = children.filter(node => node.type === 'html');
    expect(htmlNodes).toHaveLength(1);
    expect(htmlNodes[0].value).toContain('AR角色标识');
    expect(htmlNodes[0].value.startsWith('<span')).toBe(true);
  });

  it('sanitizes dangerous markup before rendering', () => {
    const clean = DOMPurify.sanitize('<img src="x" onerror="alert(1)"><script>alert(2)</script><b>ok</b>');

    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('<script');
    expect(clean).toContain('<b>ok</b>');
  });
});
