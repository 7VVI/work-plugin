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
