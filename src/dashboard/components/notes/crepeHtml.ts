import DOMPurify from 'dompurify';
import { $nodeSchema, $remark } from '@milkdown/kit/utils';
import remarkParse from 'remark-parse';

interface MdastLike {
  type?: string;
  value?: string;
  children?: MdastLike[];
}

const TAG_RE = /^<([a-zA-Z][\w-]*)(\s[^>]*)?>$/;
const CLOSE_RE = /^<\/([a-zA-Z][\w-]*)\s*>$/;
const SELF_CLOSING_RE = /^<([a-zA-Z][\w-]*)(\s[^>]*)?\/>$/;

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
 * remark 会把行内 HTML 拆成「开标签 + 内容 + 闭标签」三个节点，
 * 这里把成对的标签合并回一个 html 节点；落单的标签直接丢弃，避免露出原始标签。
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
    if (!openName) {
      result.push(node);
      index += 1;
      continue;
    }

    let depth = 1;
    let cursor = index + 1;
    let inner = '';
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
        inner += current.value;
        continue;
      }
      inner += inlineText(current);
    }

    if (!closed) {
      // 找不到闭合标签：丢弃这个孤立标签
      index += 1;
      continue;
    }

    result.push({ type: 'html', value: `${children[index].value}${inner}${children[cursor].value}` });
    index = cursor + 1;
  }

  return result;
}

function mergeInTree(node: MdastLike): void {
  if (!node.children) return;
  node.children = mergeInlineHtml(node.children);
  for (const child of node.children) mergeInTree(child);
}

/** 开启 remark 的原生 HTML 解析，并把行内标签合并成完整片段 */
export const htmlRemark = $remark('dock-raw-html', () => {
  const plugin = function enableRawHtml(this: {
    use: (plugin: unknown, options?: unknown) => unknown;
  }): (tree: MdastLike) => void {
    this.use(remarkParse, { html: true });
    return (tree: MdastLike) => mergeInTree(tree);
  };
  return plugin as never;
});

/** 行内 HTML：DOMPurify 清洗后原样渲染，序列化时还原成原始 HTML */
export const htmlInlineSchema = $nodeSchema('html_inline', () => ({
  inline: true,
  group: 'inline',
  atom: true,
  selectable: false,
  attrs: { value: { default: '' } },
  parseDOM: [
    {
      tag: 'span[data-dock-html]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.dockHtml ?? '' }),
    },
  ],
  toDOM: (node) => {
    const span = document.createElement('span');
    const raw = String(node.attrs.value ?? '');
    span.dataset.dockHtml = raw;
    span.innerHTML = DOMPurify.sanitize(raw);
    return span;
  },
  parseMarkdown: {
    match: ({ type }) => type === 'html',
    runner: (state, node, type) => {
      state.addNode(type, { value: String((node as { value?: string }).value ?? '') });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'html_inline',
    runner: (state, node) => {
      state.addNode('html', undefined, String(node.attrs.value ?? ''));
    },
  },
}));
