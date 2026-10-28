import { editorViewOptionsCtx } from '@milkdown/kit/core';
import {
  chainCommands,
  deleteSelection,
  joinBackward,
  joinForward,
  selectNodeBackward,
  selectNodeForward,
} from '@milkdown/kit/prose/commands';
import { Selection } from '@milkdown/kit/prose/state';
import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Ctx } from '@milkdown/kit/ctx';

const FENCE_PREFIX = /^```[a-z]*$/;

/**
 * 修正 Milkdown 预设里几处与思源不一致的编辑行为：
 * 1) 代码围栏输入规则会把“整段”转成代码块——光标在行首、后面还有文字时输入 ```lang + 空格，
 *    后面的文字会被一起吞进代码块。这里改为按普通文本插入。
 * 2) 标题里的 Backspace/Delete 被预设绑定成“降级标题”，这里改回普通合并/删除。
 * 3) 空行紧挨代码块等非文本块时 ProseMirror 默认不合并，空行删不掉；这里直接删掉空行。
 */
export function noteKeyBehavior(ctx: Ctx): void {
  ctx.update(editorViewOptionsCtx, prev => {
    const prevTextInput = prev.handleTextInput;
    const prevKeyDown = prev.handleKeyDown;

    return {
      ...prev,
      handleTextInput(view, from, to, text) {
        if (keepFenceAsText(view, from, to, text)) return true;
        return prevTextInput
          ? prevTextInput(view, from, to, text, () => view.state.tr.insertText(text, from, to))
          : false;
      },
      handleKeyDown(view, event) {
        if (handleEmptyBlockDelete(view, event)) return true;
        if (handleHeadingDelete(view, event)) return true;
        return prevKeyDown ? prevKeyDown(view, event) : false;
      },
    };
  });
}

function keepFenceAsText(view: EditorView, from: number, to: number, text: string): boolean {  if (text !== ' ' && text !== '\n') return false;
  if (from !== to) return false;
  const $from = view.state.doc.resolve(from);
  const parent = $from.parent;
  if (!parent.isTextblock || parent.type.spec.code) return false;
  if (!FENCE_PREFIX.test(parent.textBetween(0, $from.parentOffset, null, '\ufffc'))) return false;
  // 光标后面还有内容：这一行不是空行，整段转代码块会把后面的文字一起吞掉
  if ($from.parentOffset >= parent.content.size) return false;
  view.dispatch(view.state.tr.insertText(text, from, to));
  return true;
}

function handleHeadingDelete(view: EditorView, event: KeyboardEvent): boolean {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
  const { selection } = view.state;
  if (!selection.empty) return false;
  const { $from } = selection;
  if ($from.parent.type.name !== 'heading') return false;

  const backspace = event.key === 'Backspace';
  const atBoundary = backspace
    ? $from.parentOffset === 0
    : $from.parentOffset === $from.parent.content.size;
  if (!atBoundary) return false;

  const chain = backspace
    ? chainCommands(deleteSelection, joinBackward, selectNodeBackward)
    : chainCommands(deleteSelection, joinForward, selectNodeForward);
  chain(view.state, view.dispatch, view);
  // 始终吞掉事件，避免落到预设的“降级标题”快捷键上
  return true;
}

/** 视觉上是空行：没有内容，或只由硬换行/空白组成（Milkdown 会把空段落存成 <br />） */
function isBlankBlock(node: Node): boolean {
  if (!node.isTextblock || node.type.spec.code) return false;
  if (node.content.size === 0) return true;
  let blank = true;
  node.forEach(child => {
    if (child.isText) {
      if ((child.text ?? '').trim().length > 0) blank = false;
    } else if (child.type.name !== 'hardbreak') {
      blank = false;
    }
  });
  return blank;
}

function handleEmptyBlockDelete(view: EditorView, event: KeyboardEvent): boolean {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
  const { selection } = view.state;
  if (!selection.empty) return false;
  const { $from } = selection;
  if (!isBlankBlock($from.parent)) return false;

  const backspace = event.key === 'Backspace';
  const parent = $from.node(-1);
  const index = $from.index(-1);
  const pos = $from.before();

  if (backspace) {
    if (index <= 0) return false;
    const before = parent.child(index - 1);
    // 普通文字块交给 ProseMirror 默认合并；代码块也是文字块，但不能被合并进来
    if (!before.type.spec.code && before.isTextblock) return false;
    const tr = view.state.tr.delete(pos, pos + $from.parent.nodeSize);
    tr.setSelection(Selection.near(tr.doc.resolve(pos), -1));
    view.dispatch(tr);
    return true;
  }

  if (index >= parent.childCount - 1) return false;
  const after = parent.child(index + 1);
  if (!after.type.spec.code && after.isTextblock) return false;
  const tr = view.state.tr.delete(pos, pos + $from.parent.nodeSize);
  tr.setSelection(Selection.near(tr.doc.resolve(pos), 1));
  view.dispatch(tr);
  return true;
}

export const noteKeyHandlers = {
  keepFenceAsText,
  handleHeadingDelete,
  handleEmptyBlockDelete,
};
