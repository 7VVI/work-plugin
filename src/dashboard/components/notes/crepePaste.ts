import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';

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

/**
 * 从其它 Markdown 编辑器/VS Code 粘贴代码块时，剪贴板内容尾部常带换行，
 * 落进代码块后就会多出一行空行。这里只在粘贴后做一次收敛。
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
    if (!lastPasteAt || Date.now() - lastPasteAt > PASTE_WINDOW_MS) return null;
    lastPasteAt = 0;
    if (!transactions.some(tr => tr.docChanged)) return null;

    const from = Math.min(...transactions.map(tr => tr.mapping.map(oldState.selection.from)));
    const to = Math.max(newState.selection.to, from);
    return trimCodeBlockTail(newState, from, to);
  },
}));
