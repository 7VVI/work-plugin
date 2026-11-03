import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import { Fragment, type Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

/** 记录最近一次粘贴的时间，用来只在粘贴后做一次清理 */
let lastPasteAt = 0;
const PASTE_WINDOW_MS = 500;

function codeBlocksIn(state: EditorState, from: number, to: number): Array<{ from: number; to: number; text: string }> {
  const blocks: Array<{ from: number; to: number; text: string }> = [];
  state.doc.nodesBetween(from, to, (node: ProseNode, pos: number) => {
    if (node.type.name !== 'code_block') return;
    blocks.push({ from: pos + 1, to: pos + 1 + node.content.size, text: node.textContent });
  });
  return blocks;
}

function countCodeBlocks(doc: EditorState['doc']): number {
  let count = 0;
  doc.descendants(node => {
    if (node.type.name === 'code_block') count++;
  });
  return count;
}

/**
 * 去掉指定范围内代码块末尾的多余换行。
 * 返回的 transaction 只删除尾部换行，没有需要清理的内容时返回 null。
 */
export function trimCodeBlockTail(state: EditorState, from: number, to: number): Transaction | null {
  if (to <= from) return null;
  const targets = codeBlocksIn(state, from, to)
    .map(block => ({ ...block, keep: block.text.replace(/\n+$/, '') }))
    .filter(block => block.keep.length !== block.text.length);
  if (!targets.length) return null;

  const tr = state.tr;
  // 倒序删除，避免前面的删除影响后面记录的位置
  for (const block of targets.reverse()) {
    tr.delete(block.from + block.keep.length, block.to);
  }
  return tr;
}

/** 只接受可直接引用的图片地址，网络图保持远程 URL，不落本地资源 */
const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\(\s*((?:https?:\/\/|data:image\/|dock-asset:)[^\s)]+)(?:\s+"([^"]*)")?\s*\)/g;

/**
 * 把 Markdown 图片语法插入为图片。
 * 整段只有图片时用图片块；图片夹在文字中时用行内图片，都会保留原始 URL。
 */
export function insertMarkdownImages(view: EditorView, text: string): boolean {
  const matches = [...text.matchAll(IMAGE_MARKDOWN_RE)];
  if (!matches.length) return false;

  const onlyImages = !text.replace(IMAGE_MARKDOWN_RE, '').trim();
  if (onlyImages) {
    const nodeType = view.state.schema.nodes['image-block'];
    if (!nodeType) return false;
    const nodes: ProseNode[] = [];
    for (const match of matches) {
      const node = nodeType.createAndFill({ src: match[2], caption: '', ratio: 1 });
      if (node) nodes.push(node);
    }
    if (!nodes.length) return false;

    try {
      let tr = view.state.tr;
      for (const node of nodes) {
        tr = tr.replaceSelectionWith(node, false);
      }
      view.dispatch(tr.scrollIntoView());
      view.focus();
      return true;
    } catch {
      return false;
    }
  }

  // 行内图片：只处理单段落、无换行的粘贴，其它情况交给默认粘贴
  const { from, to, $from, $to } = view.state.selection;
  if (!$from.sameParent($to) || $from.parent.type.name !== 'paragraph') return false;
  if (/[\r\n]/.test(text)) return false;
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return false;

  const nodes: ProseNode[] = [];
  let last = 0;
  for (const match of matches) {
    const index = match.index ?? 0;
    const before = text.slice(last, index);
    if (before) nodes.push(view.state.schema.text(before));
    nodes.push(imageType.create({ src: match[2], alt: match[1] ?? '', title: match[3] ?? '' }));
    last = index + match[0].length;
  }
  const tail = text.slice(last);
  if (tail) nodes.push(view.state.schema.text(tail));
  if (!nodes.length) return false;

  try {
    view.dispatch(view.state.tr.replaceWith(from, to, Fragment.fromArray(nodes)).scrollIntoView());
    view.focus();
    return true;
  } catch {
    return false;
  }
}

export const pasteMarkdownImages = $prose(() => new Plugin({
  props: {
    handlePaste: (view, event) => {
      const text = event.clipboardData?.getData('text/plain') ?? '';
      return insertMarkdownImages(view, text);
    },
  },
}));

/**
 * 从其它 Markdown 编辑器/VS Code 粘贴代码块时，剪贴板内容尾部常带换行，
 * 落进代码块后就会多出一行空行（新建的代码块同理）。
 * 这里只在「粘贴」或「新建代码块」时收敛一次，正常编辑/回车换行不受影响。
 */
export const trimPastedCodeBlock = $prose(() => new Plugin({
  props: {
    handleDOMEvents: {
      paste: () => {
        lastPasteAt = Date.now();
        return false;
      },
    },
  },
  appendTransaction(transactions: readonly Transaction[], oldState: EditorState, newState: EditorState) {
    if (!transactions.some(tr => tr.docChanged)) return null;
    const pasted = !!lastPasteAt && Date.now() - lastPasteAt <= PASTE_WINDOW_MS;
    if (pasted) lastPasteAt = 0;

    const createdCodeBlock = countCodeBlocks(newState.doc) > countCodeBlocks(oldState.doc);
    if (!pasted && !createdCodeBlock) return null;

    if (pasted) {
      // 粘贴内容在新文档里的范围：起点向前、终点向后各取一次映射，正好包住插入的内容
      const from = Math.min(...transactions.map(tr => tr.mapping.map(oldState.selection.from, -1)));
      const to = Math.max(...transactions.map(tr => tr.mapping.map(oldState.selection.to, 1)), from);
      const inRange = trimCodeBlockTail(newState, from, to);
      if (inRange) return inRange;
    }

    // 兜底（含新建代码块的情况）：清理整篇代码块的尾部空行
    return trimCodeBlockTail(newState, 0, newState.doc.content.size);
  },
}));
