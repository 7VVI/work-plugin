import DOMPurify from 'dompurify';
import { htmlSchema } from '@milkdown/kit/preset/commonmark';
import { $remark } from '@milkdown/kit/utils';
import remarkParse from 'remark-parse';
import { INLINE_STYLE_TAGS, inlineHtmlColor } from './crepeInlineStyles';
import { parseHtmlTable } from './crepeTableHtml';

interface MdastLike {
  type?: string;
  value?: string;
  color?: string;
  children?: MdastLike[];
}

const TAG_RE = /^<([a-zA-Z][\w-]*)(\s[^>]*)?>$/;
const CLOSE_RE = /^<\/([a-zA-Z][\w-]*)\s*>$/;
const SELF_CLOSING_RE = /^<([a-zA-Z][\w-]*)(\s[^>]*)?\/>$/;

/** 空元素没有闭合标签，按原样保留，避免 <br> 之类被当成落单标签丢掉 */
const VOID_TAGS = new Set(['br', 'img', 'hr', 'input', 'wbr']);

function tagName(value: string, re: RegExp): string | null {
  const match = re.exec(value.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

/** 一段纯文本内容（保留嵌套的 html 片段，其它行内标记退化为文字） */
function inlineText(node: MdastLike): string {
  if (typeof node.value === 'string') return node.value;
  if (!node.children) return '';
  return node.children.map(inlineText).join('');
}

/**
 * remark 会把行内 HTML 拆成「开标签 + 内容 + 闭标签」三个节点：
 * - <u>/<mark>/<sup>/<sub> 和带颜色的 span 转成对应的 mark 节点，
 *   这样工具栏能识别状态，写回 Markdown 时仍是原生标签；
 * - 其余成对标签合并回一个 html 节点；落单的标签直接丢弃，避免露出原始标签。
 */
export function mergeInlineHtml(children: MdastLike[]): MdastLike[] {
  const result: MdastLike[] = [];
  let index = 0;

  while (index < children.length) {
    const node = children[index];
    if (node.type !== 'html' || typeof node.value !== 'string') {
      result.push(node);
      index += 1;
      continue;
    }

    const raw = node.value.trim();
    const openName = SELF_CLOSING_RE.test(raw) ? null : tagName(raw, TAG_RE);
    if (!openName || VOID_TAGS.has(openName)) {
      result.push(node);
      index += 1;
      continue;
    }

    let depth = 1;
    let cursor = index + 1;
    let closed = false;
    for (; cursor < children.length; cursor++) {
      const current = children[cursor];
      if (current.type === 'html' && typeof current.value === 'string') {
        if (tagName(current.value, CLOSE_RE) === openName) {
          depth -= 1;
          if (depth === 0) {
            closed = true;
            break;
          }
        } else if (tagName(current.value, TAG_RE) === openName) {
          depth += 1;
        }
      }
    }

    if (!closed) {
      // 找不到闭合标签：丢弃这个孤立标签
      index += 1;
      continue;
    }

    const inner = children.slice(index + 1, cursor);
    const styleType = (INLINE_STYLE_TAGS as Record<string, string | undefined>)[openName];
    if (styleType) {
      result.push({ type: styleType, children: mergeInlineHtml(inner) });
      index = cursor + 1;
      continue;
    }

    const color = openName === 'span' ? inlineHtmlColor(node.value) : null;
    if (color) {
      result.push({ type: 'textColor', color, children: mergeInlineHtml(inner) });
      index = cursor + 1;
      continue;
    }

    const parts: string[] = [node.value];
    for (const current of inner) {
      parts.push(
        current.type === 'html' && typeof current.value === 'string'
          ? current.value
          : inlineText(current),
      );
    }
    parts.push(children[cursor].value ?? '');
    result.push({ type: 'html', value: parts.join('') });
    index = cursor + 1;
  }

  return result;
}

/** 表格写在 HTML 块里时，先还原成 GFM 表格节点，再走行内 HTML 合并 */
const BLOCK_CONTAINERS = new Set(['root', 'blockquote', 'listItem']);

/** commonmark 预设会把块级 HTML 包进「只含一个 html 节点的段落」，两种形态都要认 */
function tableFromHtmlChild(child: MdastLike): MdastLike | null {
  if (child.type === 'html' && typeof child.value === 'string') {
    return parseHtmlTable(child.value) as MdastLike | null;
  }
  if (child.type === 'paragraph' && child.children?.length === 1) {
    const only = child.children[0];
    if (only.type === 'html' && typeof only.value === 'string') {
      return parseHtmlTable(only.value) as MdastLike | null;
    }
  }
  return null;
}

export function mergeRawHtmlTree(node: MdastLike): void {
  if (!node.children) return;
  if (BLOCK_CONTAINERS.has(node.type ?? 'root')) {
    node.children = node.children.map((child) => tableFromHtmlChild(child) ?? child);
  }
  node.children = mergeInlineHtml(node.children);
  for (const child of node.children) mergeRawHtmlTree(child);
}

/** 开启 remark 的原生 HTML 解析，并把行内标签合并成完整片段 */
export const htmlRemark = $remark('dock-raw-html', () => {
  const plugin = function enableRawHtml(this: {
    use: (plugin: unknown, options?: unknown) => unknown;
  }): (tree: MdastLike) => void {
    this.use(remarkParse, { html: true });
    return (tree: MdastLike) => mergeRawHtmlTree(tree);
  };
  return plugin as never;
});

/**
 * 预设自带的 html 节点会把原始 HTML 当纯文本渲染（span[data-value]），
 * 这里覆盖它的 toDOM：清洗后按真实 HTML 渲染，同时保留原始值以便序列化与复制。
 */
export const htmlRenderSchema = htmlSchema.extendSchema(prev => (ctx) => {
  const spec = prev(ctx);
  return {
    ...spec,
    toDOM: (node) => {
      const span = document.createElement('span');
      const raw = String(node.attrs.value ?? '');
      span.dataset.dockHtml = raw;
      span.innerHTML = DOMPurify.sanitize(raw);
      return span;
    },
    parseDOM: [
      ...(spec.parseDOM ?? []),
      {
        tag: 'span[data-dock-html]',
        getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.dockHtml ?? '' }),
      },
    ],
  };
});
