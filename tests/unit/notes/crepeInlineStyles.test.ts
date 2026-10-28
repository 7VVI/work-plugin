import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import { inlineStyleHandlers } from '../../../src/dashboard/components/notes/crepeInlineStyles';

function stringify(node: Record<string, unknown>): string {
  const processor = unified().use(remarkStringify, {
    handlers: inlineStyleHandlers as never,
  });
  return String(
    processor.stringify({ type: 'paragraph', children: [node] } as never),
  ).trim();
}

describe('inline style markdown serialization', () => {
  it('writes underline, highlight, superscript and subscript as raw html tags', () => {
    expect(stringify({ type: 'underline', children: [{ type: 'text', value: '下划线' }] })).toBe(
      '<u>下划线</u>',
    );
    expect(stringify({ type: 'highlight', children: [{ type: 'text', value: '高亮' }] })).toBe(
      '<mark>高亮</mark>',
    );
    expect(stringify({ type: 'superscript', children: [{ type: 'text', value: '2' }] })).toBe(
      '<sup>2</sup>',
    );
    expect(stringify({ type: 'subscript', children: [{ type: 'text', value: '2' }] })).toBe(
      '<sub>2</sub>',
    );
  });

  it('keeps nested markdown inside the html tags', () => {
    const markdown = stringify({
      type: 'highlight',
      children: [{ type: 'strong', children: [{ type: 'text', value: '重点' }] }],
    });

    expect(markdown).toBe('<mark>**重点**</mark>');
  });

  it('writes a text color span with the siyuan css variable', () => {
    expect(
      stringify({
        type: 'textColor',
        color: 'var(--b3-font-color6)',
        children: [{ type: 'text', value: '蓝色' }],
      }),
    ).toBe('<span style="color: var(--b3-font-color6)">蓝色</span>');
  });
});
