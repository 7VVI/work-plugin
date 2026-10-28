import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { createCodeBlockCommand } from '@milkdown/kit/preset/commonmark';
import { toggleMark } from '@milkdown/kit/prose/commands';
import { TextSelection } from '@milkdown/kit/prose/state';
import { $markSchema } from '@milkdown/kit/utils';

type ToolbarItemSpec = {
  icon: string;
  label: string;
  active: (ctx: Ctx) => boolean;
  onRun?: (ctx: Ctx) => void;
};

type ToolbarGroupHandle = {
  addItem: (key: string, item: ToolbarItemSpec) => ToolbarGroupHandle;
};

type NoteToolbarBuilder = {
  addGroup: (key: string, label: string) => ToolbarGroupHandle;
};

/** Markdown 里思源用原生标签表示下划线/高亮/上下标，这里按同样的写法往返 */
export const INLINE_STYLE_TAGS = {
  u: 'underline',
  mark: 'highlight',
  sup: 'superscript',
  sub: 'subscript',
} as const;

/** 从 <span style="color: …"> 的开标签里取颜色值，background-color 等不算 */
function colorFromStyle(style: string | null | undefined): string | null {
  if (!style) return null;
  const match = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
  if (!match) return null;
  const color = match[1].replace(/["'<>]/g, '').trim();
  return color || null;
}

export function inlineHtmlColor(openTag: string): string | null {
  const style = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(openTag);
  if (!style) return null;
  return colorFromStyle(style[2] ?? style[3]);
}

const underlineSchema = $markSchema('underline', () => ({
  parseDOM: [{ tag: 'u' }],
  toDOM: () => ['u', 0],
  parseMarkdown: {
    match: (node) => node.type === 'underline',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'underline',
    runner: (state, mark) => {
      state.withMark(mark, 'underline');
    },
  },
}));

const highlightSchema = $markSchema('highlight', () => ({
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', 0],
  parseMarkdown: {
    match: (node) => node.type === 'highlight',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'highlight',
    runner: (state, mark) => {
      state.withMark(mark, 'highlight');
    },
  },
}));

const superscriptSchema = $markSchema('superscript', () => ({
  parseDOM: [{ tag: 'sup' }],
  toDOM: () => ['sup', 0],
  parseMarkdown: {
    match: (node) => node.type === 'superscript',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'superscript',
    runner: (state, mark) => {
      state.withMark(mark, 'superscript');
    },
  },
}));

const subscriptSchema = $markSchema('subscript', () => ({
  parseDOM: [{ tag: 'sub' }],
  toDOM: () => ['sub', 0],
  parseMarkdown: {
    match: (node) => node.type === 'subscript',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'subscript',
    runner: (state, mark) => {
      state.withMark(mark, 'subscript');
    },
  },
}));

const textColorSchema = $markSchema('text_color', () => ({
  attrs: { color: { default: '' } },
  parseDOM: [
    {
      tag: 'span[style]',
      getAttrs: (dom) => {
        const color = colorFromStyle((dom as HTMLElement).getAttribute('style'));
        return color ? { color } : false;
      },
    },
  ],
  toDOM: (mark) => ['span', { style: `color: ${String(mark.attrs.color ?? '')}` }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'textColor',
    runner: (state, node, markType) => {
      state.openMark(markType, { color: String(node.color ?? '') });
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'text_color',
    runner: (state, mark) => {
      state.withMark(mark, 'textColor', undefined, { color: String(mark.attrs.color ?? '') });
    },
  },
}));

export const inlineStyleSchemas = [
  underlineSchema,
  highlightSchema,
  superscriptSchema,
  subscriptSchema,
  textColorSchema,
];

/** 把 <u>/<mark>/<sup>/<sub> 和带颜色的 span 写成原始 HTML，思源与导出的 Markdown 都认 */
type MdastHandler = (node: any, parent: any, state: any, info: any) => string;

function inlineTagHandler(tag: string): MdastHandler {
  return (node, _parent, state, info) => {
    const exit = state.enter(tag);
    const tracker = state.createTracker(info);
    let value = tracker.move(`<${tag}>`);
    value += tracker.move(
      state.containerPhrasing(node, {
        before: value,
        after: `</${tag}>`,
        ...tracker.current(),
      }),
    );
    value += tracker.move(`</${tag}>`);
    exit();
    return value;
  };
}

export const inlineStyleHandlers: Record<string, MdastHandler> = {
  underline: inlineTagHandler('u'),
  highlight: inlineTagHandler('mark'),
  superscript: inlineTagHandler('sup'),
  subscript: inlineTagHandler('sub'),
  textColor: (node, _parent, state, info) => {
    const open = `<span style="color: ${String(node.color ?? '')}">`;
    const exit = state.enter('textColor');
    const tracker = state.createTracker(info);
    let value = tracker.move(open);
    value += tracker.move(
      state.containerPhrasing(node, {
        before: value,
        after: '</span>',
        ...tracker.current(),
      }),
    );
    value += tracker.move('</span>');
    exit();
    return value;
  },
};

export function inlineStyleStringify(ctx: Ctx): void {
  ctx.update(remarkStringifyOptionsCtx, (options) => ({
    ...options,
    handlers: {
      ...options.handlers,
      ...inlineStyleHandlers,
    } as unknown as typeof options.handlers,
  }));
}

/* ---------------- 浮动工具栏 ---------------- */

const ICON_UNDERLINE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 16.2c2.98 0 5.4-2.42 5.4-5.4V4.5h-2.1v6.3c0 1.82-1.48 3.3-3.3 3.3s-3.3-1.48-3.3-3.3V4.5H6.6v6.3c0 2.98 2.42 5.4 5.4 5.4Z"/><path d="M5.6 18.9h12.8v1.7H5.6z"/></svg>`;

const ICON_HIGHLIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15.9 3.2a2.3 2.3 0 0 1 3.2 0l1.7 1.7a2.3 2.3 0 0 1 0 3.2l-8.6 8.6-4.9-4.9 8.6-8.6Z"/><path d="M6.1 13l4.9 4.9-1.2 1.2H5.1a1 1 0 0 1-1-1v-3.9l2-1.2Z"/><path d="M4.5 20.2h15v1.6h-15z"/></svg>`;

const ICON_SUPERSCRIPT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M2.2 18.6 6.8 12 2.4 5.4h2.4l3 4.5 3.1-4.5h2.4L8.9 12l4.6 6.6h-2.4l-3.5-5-3.5 5H2.2Z"/><text x="13.6" y="9.6" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="700" fill="currentColor">2</text></svg>`;

const ICON_SUBSCRIPT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M2.2 16.1 6.8 9.5 2.4 2.9h2.4l3 4.5 3.1-4.5h2.4L8.9 9.5l4.6 6.6h-2.4l-3.5-5-3.5 5H2.2Z"/><text x="13.6" y="20.8" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="700" fill="currentColor">2</text></svg>`;

const ICON_TEXT_COLOR = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5.1 16.8 10.4 4.2h2.4l5.3 12.6h-2.3l-1.1-2.8H8.5l-1.1 2.8H5.1Zm4-4.7h4.9L11.6 5.9 9.1 12.1Z"/><rect x="4.2" y="19.1" width="15.6" height="2.6" rx="1.3" fill="var(--b3-font-color6, currentColor)"/></svg>`;

const ICON_CLEAR = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14.9 3.3a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8l-7.6 7.6-5-5 7.6-7.6Z"/><path d="M5.9 12.4l5 5-1.5 1.5H5.1a1.3 1.3 0 0 1-1.3-1.3v-3.8l2.1-1.4Z"/><path d="M9.9 20.5h10.6v1.6H9.9z"/></svg>`;

const ICON_CODE_BLOCK = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"><path d="M3 4h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v12h18V6H3Zm5.1 2.4L4.6 12l3.5 3.6 1.4-1.3L7.4 12l2.1-2.3-1.4-1.3Zm7.8 0-1.4 1.3 2.1 2.3-2.1 2.3 1.4 1.3 3.5-3.6-3.5-3.6Z"/></svg>`;

const FONT_COLOR_COUNT = 13;

function markActive(ctx: Ctx, name: string): boolean {
  const { state } = ctx.get(editorViewCtx);
  const type = state.schema.marks[name];
  if (!type) return false;
  const { from, to } = state.selection;
  return from !== to && state.doc.rangeHasMark(from, to, type);
}

function toggleInlineMark(name: string) {
  return (ctx: Ctx): void => {
    const view = ctx.get(editorViewCtx);
    const type = view.state.schema.marks[name];
    if (!type) return;
    toggleMark(type)(view.state, view.dispatch, view);
    view.focus();
  };
}

function clearFormatting(ctx: Ctx): void {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const { from, to } = state.selection;
  if (from === to) return;
  view.dispatch(state.tr.removeMark(from, to));
  view.focus();
}

function createCodeBlock(ctx: Ctx): void {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const { from, to } = state.selection;
  const codeType = state.schema.nodes.code_block;
  const commands = ctx.get(commandsCtx);

  if (!codeType || from === to) {
    commands.call(createCodeBlockCommand.key);
    view.focus();
    return;
  }

  // 跨多个段落时合成一个代码块（思源的行为），只选单块则交给内置命令保留整段
  const blocks: { from: number; to: number; text: string }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    if (pos + 1 <= to && pos + node.nodeSize - 1 >= from) {
      blocks.push({ from: pos, to: pos + node.nodeSize, text: node.textContent });
    }
    return false;
  });
  if (blocks.length < 2) {
    commands.call(createCodeBlockCommand.key);
    view.focus();
    return;
  }

  const text = blocks.map((block) => block.text).join('\n');
  const codeBlock = codeType.create({ language: '' }, text ? state.schema.text(text) : null);
  const tr = state.tr.replaceWith(blocks[0].from, blocks[blocks.length - 1].to, codeBlock);
  tr.setSelection(TextSelection.near(tr.doc.resolve(blocks[0].from + 1 + text.length)));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/* ---- 字体颜色面板 ---- */

let colorPanel: HTMLElement | null = null;
let panelListeners: AbortController | null = null;
let panelRange: { from: number; to: number } | null = null;

export function closeColorPanel(): void {
  colorPanel?.remove();
  colorPanel = null;
  panelRange = null;
  panelListeners?.abort();
  panelListeners = null;
}

function applyTextColor(ctx: Ctx, color: string): void {
  const view = ctx.get(editorViewCtx);
  const type = view.state.schema.marks.text_color;
  const range = panelRange;
  if (!type || !range) return;
  const max = view.state.doc.content.size;
  const from = Math.min(range.from, max);
  const to = Math.min(range.to, max);
  if (from >= to) return;
  const tr = view.state.tr.removeMark(from, to, type);
  if (color) tr.addMark(from, to, type.create({ color }));
  view.dispatch(tr);
  view.focus();
}

function buildColorPanel(ctx: Ctx, anchor: HTMLElement): void {
  const panel = document.createElement('div');
  panel.className = 'note-color-panel';
  for (let index = 1; index <= FONT_COLOR_COUNT; index += 1) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'note-color-swatch';
    swatch.dataset.color = `var(--b3-font-color${index})`;
    swatch.title = `文字颜色 ${index}`;
    swatch.style.background = `var(--b3-font-color${index})`;
    panel.appendChild(swatch);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'note-color-reset';
  reset.dataset.color = '';
  reset.textContent = '默认颜色';
  panel.appendChild(reset);

  const rect = anchor.getBoundingClientRect();
  const host = anchor.closest('.milkdown') ?? document.body;
  host.appendChild(panel);

  const size = panel.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - size.width - 8));
  const top = rect.bottom + 6 + size.height <= window.innerHeight
    ? rect.bottom + 6
    : Math.max(8, rect.top - size.height - 6);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;

  panel.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-color]');
    if (!target) return;
    applyTextColor(ctx, target.dataset.color ?? '');
    closeColorPanel();
  });

  const listeners = new AbortController();
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (panel.contains(target)) return;
      if (target?.closest('[data-toolbar-item="text-color"]')) return;
      closeColorPanel();
    },
    { capture: true, signal: listeners.signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') closeColorPanel();
    },
    { capture: true, signal: listeners.signal },
  );
  document.addEventListener('selectionchange', closeColorPanel, { signal: listeners.signal });
  window.addEventListener('resize', closeColorPanel, { signal: listeners.signal });
  window.addEventListener('scroll', closeColorPanel, { capture: true, signal: listeners.signal });

  colorPanel = panel;
  panelListeners = listeners;
}

function openColorPanel(ctx: Ctx): void {
  if (colorPanel) {
    closeColorPanel();
    return;
  }
  const anchor = document.querySelector<HTMLElement>('.milkdown-toolbar [data-toolbar-item="text-color"]');
  if (!anchor) return;
  const { from, to } = ctx.get(editorViewCtx).state.selection;
  if (from === to) return;
  panelRange = { from, to };
  buildColorPanel(ctx, anchor);
}

export function buildNoteToolbar(builder: NoteToolbarBuilder): void {
  const styleGroup = builder.addGroup('inline-style', '样式');
  styleGroup.addItem('underline', {
    icon: ICON_UNDERLINE,
    label: '下划线',
    active: (ctx) => markActive(ctx, 'underline'),
    onRun: toggleInlineMark('underline'),
  });
  styleGroup.addItem('highlight', {
    icon: ICON_HIGHLIGHT,
    label: '高亮',
    active: (ctx) => markActive(ctx, 'highlight'),
    onRun: toggleInlineMark('highlight'),
  });
  styleGroup.addItem('superscript', {
    icon: ICON_SUPERSCRIPT,
    label: '上标',
    active: (ctx) => markActive(ctx, 'superscript'),
    onRun: toggleInlineMark('superscript'),
  });
  styleGroup.addItem('subscript', {
    icon: ICON_SUBSCRIPT,
    label: '下标',
    active: (ctx) => markActive(ctx, 'subscript'),
    onRun: toggleInlineMark('subscript'),
  });
  styleGroup.addItem('text-color', {
    icon: ICON_TEXT_COLOR,
    label: '字体颜色',
    active: (ctx) => markActive(ctx, 'text_color'),
    onRun: openColorPanel,
  });
  styleGroup.addItem('clear-style', {
    icon: ICON_CLEAR,
    label: '清除样式',
    active: () => false,
    onRun: clearFormatting,
  });

  builder.addGroup('block-style', '块级').addItem('code-block', {
    icon: ICON_CODE_BLOCK,
    label: '代码块',
    active: () => false,
    onRun: createCodeBlock,
  });
}
