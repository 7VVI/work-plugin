export interface OutlineItem {
  level: number;
  text: string;
  index: number;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<[^>]+>/g, '');
}

/** 将 Markdown 粗略转成纯文本，用于搜索片段、字数和标题展示 */
export function markdownToPlainText(markdown: string): string {
  return stripInlineMarkdown(
    markdown
      .replace(/\r\n?/g, '\n')
      .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*$/gm, '')
      .replace(/^ {0,3}(#{1,6})\s+/gm, '')
      .replace(/^ {0,3}(?:[-*+]|\d+\.)\s+/gm, '')
      .replace(/^ {0,3}>\s?/gm, ''),
  );
}

/**
 * 提取大纲标题。识别围栏代码块，忽略代码块内部的 #，
 * 只收集真正的顶层 ATX 标题。
 */
export function extractOutline(markdown: string): OutlineItem[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const items: OutlineItem[] = [];
  let inFence = false;
  let fenceChar = '';
  let fenceLength = 0;

  for (const line of lines) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      const marker = fence[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLength && fence[2].trim() === '') {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/);
    if (!heading) continue;
    const text = stripInlineMarkdown(heading[2]).trim();
    if (!text) continue;
    items.push({ level: heading[1].length, text, index: items.length });
  }

  return items;
}

export function countNoteWords(markdown: string): number {
  const text = markdownToPlainText(markdown);
  const cjk = text.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g)?.length ?? 0;
  const words = text
    .replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, ' ')
    .match(/[A-Za-z0-9_]+(?:['’-][A-Za-z0-9_]+)*/g)?.length ?? 0;
  return cjk + words;
}

export function sanitizeFilename(title: string): string {
  const cleaned = [...title]
    .map(ch => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 32 || code === 127 || '\\/:*?"<>|'.includes(ch) ? ' ' : ch;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || '未命名笔记';
}

export function buildSearchSnippet(content: string, query: string, max = 120): string {
  const text = markdownToPlainText(content).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const q = query.trim();
  if (!q) return text.length > max ? `${text.slice(0, max)}…` : text;

  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return text.length > max ? `${text.slice(0, max)}…` : text;

  const start = Math.max(0, at - Math.floor(max / 3));
  const end = Math.min(text.length, start + max);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export function utf8Bytes(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return value.length;
}
