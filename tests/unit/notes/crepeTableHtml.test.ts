import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { mergeRawHtmlTree } from '../../../src/dashboard/components/notes/crepeHtml';
import { parseHtmlTable } from '../../../src/dashboard/components/notes/crepeTableHtml';

interface MdastLike {
  type?: string;
  value?: string;
  align?: unknown;
  colspan?: number;
  rowspan?: number;
  colwidth?: number[];
  isHeader?: boolean;
  children?: MdastLike[];
}

const TABLE_HTML =
  '<table><colgroup><col style="width: 120px"><col style="width: 200px"></colgroup>'
  + '<thead><tr><th colspan="2" style="text-align:center">合并表头</th></tr></thead>'
  + '<tbody><tr><td rowspan="2">跨行</td><td>右一</td></tr><tr><td>右二</td></tr></tbody></table>';

describe('html table parsing', () => {
  it('keeps colspan, rowspan, colwidth and alignment', () => {
    const table = parseHtmlTable(TABLE_HTML) as MdastLike | null;

    expect(table?.type).toBe('table');
    expect(table?.align).toEqual(['center', 'center']);
    const header = table?.children?.[0]?.children?.[0];
    expect(header?.colspan).toBe(2);
    expect(header?.colwidth).toEqual([120, 200]);
    expect(header?.children).toEqual([{ type: 'text', value: '合并表头' }]);
    const firstBody = table?.children?.[1]?.children?.[0];
    expect(firstBody?.rowspan).toBe(2);
    expect(firstBody?.colwidth).toEqual([120]);
    expect(table?.children?.[2]?.children?.[0]?.children).toEqual([{ type: 'text', value: '右二' }]);
  });

  it('converts inline formatting inside cells back to mdast marks', () => {
    const table = parseHtmlTable(
      '<table><thead><tr><th><strong>粗</strong><u>下划线</u><code>x</code></th></tr></thead>'
      + '<tbody><tr><td><span style="color: var(--b3-font-color6)">蓝</span></td><td><a href="https://a.example">链</a></td></tr></tbody></table>',
    ) as MdastLike | null;

    expect(table?.children?.[0]?.children?.[0]?.children).toEqual([
      { type: 'strong', children: [{ type: 'text', value: '粗' }] },
      { type: 'underline', children: [{ type: 'text', value: '下划线' }] },
      { type: 'inlineCode', value: 'x' },
    ]);
    expect(table?.children?.[1]?.children?.[0]?.children).toEqual([
      { type: 'textColor', color: 'var(--b3-font-color6)', children: [{ type: 'text', value: '蓝' }] },
    ]);
    expect(table?.children?.[1]?.children?.[1]?.children).toEqual([
      { type: 'link', url: 'https://a.example', title: null, children: [{ type: 'text', value: '链' }] },
    ]);
  });

  it('turns a standalone html table into a table node through the remark transformer', () => {
    const processor = unified().use(remarkParse, { html: true });
    const tree = processor.parse(TABLE_HTML) as MdastLike;
    mergeRawHtmlTree(tree);

    expect(tree.children?.[0]?.type).toBe('table');
    expect(tree.children?.[0]?.children).toHaveLength(3);
  });

  it('converts the html node the commonmark preset wraps in a paragraph', () => {
    const tree: MdastLike = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'html', value: TABLE_HTML }],
        },
      ],
    };
    mergeRawHtmlTree(tree);

    expect(tree.children?.[0]?.type).toBe('table');
  });

  it('leaves non-table html alone', () => {
    expect(parseHtmlTable('<div>text</div>')).toBeNull();
    expect(parseHtmlTable('<table><tr><td>x</td></tr>')).toBeNull();
  });
});
