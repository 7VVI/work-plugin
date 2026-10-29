import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import {
  addBlockTypeCommand,
  clearTextInCurrentBlockCommand,
  selectTextNearPosCommand,
} from '@milkdown/kit/preset/commonmark';
import {
  createTable,
  selectTable,
  tableCellSchema,
  tableHeaderSchema,
  tableRowSchema,
  tableSchema,
} from '@milkdown/kit/preset/gfm';
import type { Node as PMNode } from '@milkdown/kit/prose/model';
import { DOMSerializer } from '@milkdown/kit/prose/model';
import type { EditorState } from '@milkdown/kit/prose/state';
import { Plugin, PluginKey, Selection, TextSelection } from '@milkdown/kit/prose/state';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  cellAround,
  deleteColumn,
  deleteRow,
  deleteTable as deleteTableCommand,
  selectedRect,
  TableMap,
} from '@milkdown/kit/prose/tables';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { needsHtmlTable, serializeTableHtml } from './crepeTableHtml';

type SlashItem = { label: string; icon: string; onRun?: (ctx: Ctx) => void };
type SlashGroup = { addItem: (key: string, item: SlashItem) => SlashGroup };
type SlashBuilder = {
  addGroup: (key: string, label: string) => SlashGroup;
  getGroup: (key: string) => SlashGroup;
};

const TABLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 3.5h17A1.5 1.5 0 0 1 22 5v14a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 19V5a1.5 1.5 0 0 1 1.5-1.5ZM4 7.2v3.2h6.4V7.2H4Zm8.4 0v3.2H20V7.2h-7.6ZM4 12.4v3.2h6.4v-3.2H4Zm8.4 0v3.2H20v-3.2h-7.6ZM4 17.6v1.4h6.4v-1.4H4Zm8.4 0v1.4H20v-1.4h-7.6Z"/></svg>`;

/**
 * 关闭 Crepe 自带表格块后，斜杠菜单里的「表格」入口需要自己补回来，
 * 逻辑与 Crepe 内置实现一致：清空当前块 → 插入 3×3 表格 → 光标落到首格。
 */
export function buildNoteMenu(builder: SlashBuilder): void {
  let group: SlashGroup;
  try {
    group = builder.getGroup('advanced');
  } catch {
    group = builder.addGroup('advanced-extra', '高级');
  }
  group.addItem('table', {
    label: '表格',
    icon: TABLE_ICON,
    onRun: (ctx) => {
      const commands = ctx.get(commandsCtx);
      const view = ctx.get(editorViewCtx);
      commands.call(clearTextInCurrentBlockCommand.key);
      const { from } = view.state.selection;
      commands.call(addBlockTypeCommand.key, { nodeType: createTable(ctx, 3, 3) });
      commands.call(selectTextNearPosCommand.key, { pos: from });
    },
  });
}

/* ---------------- Markdown 往返：复杂表格写成 HTML ---------------- */

function parseCellMarkdown(state: any, node: any, type: any): void {
  const attrs: Record<string, unknown> = { alignment: node.align ?? 'left' };
  const colspan = Number(node.colspan ?? 1);
  const rowspan = Number(node.rowspan ?? 1);
  if (colspan > 1) attrs.colspan = colspan;
  if (rowspan > 1) attrs.rowspan = rowspan;
  if (Array.isArray(node.colwidth)) attrs.colwidth = node.colwidth;
  state.openNode(type, attrs);
  state.openNode(state.schema.nodes.paragraph);
  state.next(node.children);
  state.closeNode();
  state.closeNode();
}

/** HTML 表格允许每个单元格单独对齐，优先用单元格自己的 align */
function parseRowMarkdown(state: any, node: any, type: any): void {
  const aligns = Array.isArray(node.align) ? node.align : [];
  const children = (node.children ?? []).map((child: any, index: number) => ({
    ...child,
    align: child.align ?? aligns[index] ?? 'left',
  }));
  state.openNode(type);
  state.next(children);
  state.closeNode();
}

const tableCellParse = tableCellSchema.extendSchema((prevSchema) => (ctx) => {
  const spec = prevSchema(ctx);
  return {
    ...spec,
    parseMarkdown: { ...spec.parseMarkdown, runner: parseCellMarkdown },
  };
});

const tableHeaderParse = tableHeaderSchema.extendSchema((prevSchema) => (ctx) => {
  const spec = prevSchema(ctx);
  return {
    ...spec,
    parseMarkdown: { ...spec.parseMarkdown, runner: parseCellMarkdown },
  };
});

const tableRowParse = tableRowSchema.extendSchema((prevSchema) => (ctx) => {
  const spec = prevSchema(ctx);
  return {
    ...spec,
    parseMarkdown: { ...spec.parseMarkdown, runner: parseRowMarkdown },
  };
});

/** 有合并单元格或自定义列宽时写成 HTML 表，简单表格继续用管道语法 */
const tableHtmlMarkdown = tableSchema.extendSchema((prevSchema) => (ctx) => {
  const spec = prevSchema(ctx);
  return {
    ...spec,
    toMarkdown: {
      match: spec.toMarkdown.match,
      runner: (state: any, node: any) => {
        if (!needsHtmlTable(node)) {
          spec.toMarkdown.runner(state, node);
          return;
        }
        state.addNode('html', undefined, serializeTableHtml(node, state.schema));
      },
    },
  };
});

export const tableMarkdownSchemas = [
  tableCellParse,
  tableHeaderParse,
  tableRowParse,
  tableHtmlMarkdown,
];

/* ---------------- 单元格多选面板与右键菜单 ---------------- */

type TableCommand = (state: any, dispatch?: any, view?: any) => boolean;

type MenuEntry =
  | { separator: true }
  | {
      label: string;
      icon?: string;
      shortcut?: string;
      run?: () => void;
      submenu?: MenuEntry[];
    };

interface CellRef {
  node: PMNode;
  pos: number;
}

interface CellBlock {
  rows: CellRef[][];
  positions: number[];
}

let menuEl: HTMLElement | null = null;
let menuCleanup: AbortController | null = null;
let panelEl: HTMLElement | null = null;
let panelCleanup: AbortController | null = null;
let lastView: EditorView | null = null;

function isSeparator(entry: MenuEntry): entry is { separator: true } {
  return 'separator' in entry;
}

function buildSeparator(): HTMLElement {
  const separator = document.createElement('div');
  separator.className = 'ntm-sep';
  return separator;
}

function buildItem(entry: Exclude<MenuEntry, { separator: true }>, onRun: (run?: () => void) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'ntm-item';
  if (entry.submenu) row.classList.add('has-sub');

  const icon = document.createElement('i');
  icon.className = `ntm-icon ${entry.icon ?? ''}`;
  row.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'ntm-label';
  label.textContent = entry.label;
  row.appendChild(label);

  if (entry.shortcut) {
    const key = document.createElement('span');
    key.className = 'ntm-key';
    key.textContent = entry.shortcut;
    row.appendChild(key);
  }

  if (entry.submenu) {
    const arrow = document.createElement('i');
    arrow.className = 'fa-solid fa-chevron-right ntm-arrow';
    row.appendChild(arrow);
    const submenu = document.createElement('div');
    submenu.className = 'ntm-submenu';
    for (const sub of entry.submenu) {
      submenu.appendChild(isSeparator(sub) ? buildSeparator() : buildItem(sub, onRun));
    }
    row.appendChild(submenu);
    return row;
  }

  row.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRun(entry.run);
  });
  return row;
}

function buildMenu(
  className: string,
  entries: MenuEntry[],
  onRun: (run?: () => void) => void,
): HTMLElement {
  const menu = document.createElement('div');
  menu.className = className;
  for (const entry of entries) {
    menu.appendChild(isSeparator(entry) ? buildSeparator() : buildItem(entry, onRun));
  }
  return menu;
}

function placeMenu(element: HTMLElement, x: number, y: number): void {
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  const rect = element.getBoundingClientRect();
  element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
}

export function closeTableMenu(): void {
  menuEl?.remove();
  menuEl = null;
  menuCleanup?.abort();
  menuCleanup = null;
  // 菜单操作完若仍是单元格选区，把多选面板恢复回来
  window.setTimeout(() => {
    if (!menuEl && lastView) syncTablePanel(lastView);
  }, 0);
}

export function closeTablePanel(): void {
  panelEl?.remove();
  panelEl = null;
  panelCleanup?.abort();
  panelCleanup = null;
}

export function destroyTableUi(): void {
  closeTableMenu();
  closeTablePanel();
  lastView = null;
}

/** 右键是否落在表格单元格里 */
export function isTableTarget(target: EventTarget | null, root: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return false;
  const cell = target.closest('td, th');
  if (!cell) return false;
  return !root || root.contains(cell);
}

function collectCellBlock(state: EditorState): CellBlock | null {
  if (!(state.selection instanceof CellSelection)) return null;
  const rect = selectedRect(state);
  const rows: CellRef[][] = [];
  const positions: number[] = [];
  const seen = new Set<number>();
  for (let row = rect.top; row < rect.bottom; row += 1) {
    const cells: CellRef[] = [];
    for (let col = rect.left; col < rect.right; col += 1) {
      const pos = rect.tableStart + rect.map.map[row * rect.map.width + col];
      if (seen.has(pos)) continue;
      const node = state.doc.nodeAt(pos);
      if (!node) continue;
      seen.add(pos);
      cells.push({ node, pos });
      positions.push(pos);
    }
    rows.push(cells);
  }
  return rows.length ? { rows, positions } : null;
}

function cellBlockText(block: CellBlock): string {
  return block.rows
    .map((cells) => cells.map((cell) => cell.node.textContent.replace(/\s+/g, ' ').trim()).join('\t'))
    .join('\n');
}

function cellBlockHtml(block: CellBlock, state: EditorState): string {
  const serializer = DOMSerializer.fromSchema(state.schema);
  const render = (cell: CellRef): string => {
    const holder = document.createElement('div');
    holder.appendChild(serializer.serializeFragment(cell.node.content));
    return holder.innerHTML;
  };
  const rows = block.rows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${render(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><tbody>${rows}</tbody></table>`;
}

async function writeClipboardText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

async function writeClipboardRich(text: string, html: string): Promise<void> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ]);
  } catch {
    await writeClipboardText(text);
  }
}

async function copySelection(view: EditorView, mode: 'text' | 'rich'): Promise<void> {
  const block = collectCellBlock(view.state);
  if (!block) return;
  const text = cellBlockText(block);
  if (mode === 'text') await writeClipboardText(text);
  else await writeClipboardRich(text, cellBlockHtml(block, view.state));
}

function clearCells(view: EditorView, block: CellBlock): void {
  const paragraph = view.state.schema.nodes.paragraph.create();
  const tr = view.state.tr;
  for (const pos of block.positions) {
    const node = view.state.doc.nodeAt(pos);
    if (!node) continue;
    const mapped = tr.mapping.map(pos);
    tr.replaceWith(mapped + 1, mapped + node.nodeSize - 1, paragraph);
  }
  if (tr.docChanged) view.dispatch(tr);
  view.focus();
}

async function cutSelection(view: EditorView): Promise<void> {
  const block = collectCellBlock(view.state);
  if (!block) return;
  await writeClipboardRich(cellBlockText(block), cellBlockHtml(block, view.state));
  clearCells(view, block);
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|~>])/g, '\\$1');
}

async function readClipboardHtml(): Promise<string | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        return await (await item.getType('text/html')).text();
      }
    }
  } catch {
    // 剪贴板不支持富文本读取时退回纯文本
  }
  return null;
}

async function pasteIntoSelection(view: EditorView, mode: 'rich' | 'text' | 'escape'): Promise<void> {
  if (mode === 'rich' && !(view.state.selection instanceof CellSelection)) {
    const html = await readClipboardHtml();
    if (html) {
      view.pasteHTML(html);
      view.focus();
      return;
    }
  }
  let raw: string | null = null;
  try {
    raw = await navigator.clipboard.readText();
  } catch {
    raw = null;
  }
  if (raw === null) return;
  const value = mode === 'escape' ? escapeMarkdown(raw) : raw;
  if (!value) return;
  const state = view.state;
  const from = state.selection instanceof CellSelection ? state.selection.$anchorCell.pos + 1 : state.selection.from;
  const tr = state.tr.insertText(value, from, from);
  tr.setSelection(TextSelection.near(tr.doc.resolve(from + value.length)));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

function applyAlignment(view: EditorView, align: string | null): void {
  const { state } = view;
  const $cell = state.selection instanceof CellSelection
    ? state.selection.$anchorCell
    : cellAround(state.selection.$from);
  if (!$cell) return;
  const table = $cell.node(-1);
  const map = TableMap.get(table);
  const start = $cell.start(-1);
  let left = 0;
  let right = map.width;
  if (state.selection instanceof CellSelection) {
    const rect = selectedRect(state);
    left = rect.left;
    right = rect.right;
  } else {
    const found = map.findCell($cell.pos - start);
    left = found.left;
    right = found.right;
  }

  // keepTableAlignPlugin 会按表头同步整列对齐，这里同样把整列（含表头）一起改
  const tr = state.tr;
  const seen = new Set<number>();
  for (let row = 0; row < map.height; row += 1) {
    for (let col = left; col < right; col += 1) {
      const pos = start + map.map[row * map.width + col];
      if (seen.has(pos)) continue;
      seen.add(pos);
      const node = state.doc.nodeAt(pos);
      if (!node) continue;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, alignment: align });
    }
  }
  if (tr.docChanged) view.dispatch(tr);
  view.focus();
}

function applyCommand(view: EditorView, command: TableCommand): void {
  if (command(view.state, view.dispatch, view)) view.focus();
}

/**
 * prosemirror-tables 的 mergeCells 会把各单元格的段落依次塞进合并单元格，
 * 但 Milkdown 的单元格只允许一个段落，直接调用会把表格结构写坏。
 * 这里做同样的结构合并，但把文字收进同一个段落（用硬换行分隔）。
 */
function mergeSelectedCells(state: EditorState, dispatch?: (tr: any) => void): boolean {
  const selection = state.selection;
  if (!(selection instanceof CellSelection) || selection.$anchorCell.pos === selection.$headCell.pos) return false;
  const rect = selectedRect(state);
  const { map, table, tableStart } = rect;
  const firstPos = map.map[rect.top * map.width + rect.left];
  const firstCell = table.nodeAt(firstPos);
  if (!firstCell) return false;

  const seen = new Set<number>();
  const others: number[] = [];
  const cells: PMNode[] = [];
  for (let row = rect.top; row < rect.bottom; row += 1) {
    for (let col = rect.left; col < rect.right; col += 1) {
      const pos = map.map[row * map.width + col];
      if (seen.has(pos)) continue;
      seen.add(pos);
      const cell = table.nodeAt(pos);
      if (!cell) continue;
      const bounds = map.findCell(pos);
      if (bounds.left < rect.left || bounds.right > rect.right) return false;
      if (bounds.top < rect.top || bounds.bottom > rect.bottom) return false;
      cells.push(cell);
      if (pos !== firstPos) others.push(pos);
    }
  }
  if (!dispatch) return true;

  const hardbreak = state.schema.nodes.hardbreak.create();
  const inline: PMNode[] = [];
  for (const cell of cells) {
    const paragraph = cell.firstChild;
    if (!paragraph) continue;
    if (inline.length) inline.push(hardbreak);
    paragraph.forEach((node) => inline.push(node));
  }
  const paragraph = state.schema.nodes.paragraph.create(null, inline);

  const tr = state.tr;

  // 只删多余的单元格，保留行：合并单元格的 rowspan 需要这些行存在
  for (const pos of [...others].sort((a, b) => b - a)) {
    const node = table.nodeAt(pos);
    if (!node) continue;
    tr.delete(tableStart + pos, tableStart + pos + node.nodeSize);
  }

  const widths: number[] = [];
  for (let col = rect.left; col < rect.right; col += 1) {
    const pos = map.map[rect.top * map.width + col];
    const owner = table.nodeAt(pos);
    const colwidth = owner?.attrs.colwidth as number[] | null | undefined;
    const index = owner ? col - map.colCount(pos) : 0;
    widths.push(colwidth?.[index] ?? 0);
  }

  const start = tableStart + firstPos;
  tr.replaceWith(start + 1, start + firstCell.nodeSize - 1, paragraph);
  tr.setNodeMarkup(start, undefined, {
    ...firstCell.attrs,
    colspan: rect.right - rect.left,
    rowspan: rect.bottom - rect.top,
    colwidth: widths.some((width) => width > 0) ? widths : null,
  });
  tr.setSelection(new CellSelection(tr.doc.resolve(start)));
  dispatch(tr);
  return true;
}

function selectAllCells(view: EditorView): void {
  const tr = selectTable(view.state.tr);
  if (!tr.selection.eq(view.state.selection)) view.dispatch(tr);
  view.focus();
}

function cellMenuEntries(view: EditorView): MenuEntry[] {
  return [
    { label: '粘贴', shortcut: 'Ctrl+V', icon: 'fa-regular fa-paste', run: () => void pasteIntoSelection(view, 'rich') },
    { label: '粘贴为纯文本', shortcut: 'Ctrl+Shift+V', icon: 'fa-regular fa-clipboard', run: () => void pasteIntoSelection(view, 'text') },
    { label: '粘贴转义文本', icon: 'fa-solid fa-code', run: () => void pasteIntoSelection(view, 'escape') },
    { separator: true },
    { label: '全选', shortcut: 'Ctrl+A', icon: 'fa-solid fa-check', run: () => selectAllCells(view) },
    { separator: true },
    { label: '在上方插入一行', icon: 'fa-solid fa-arrow-up-long', run: () => applyCommand(view, addRowBefore) },
    { label: '在下方插入一行', icon: 'fa-solid fa-arrow-down-long', run: () => applyCommand(view, addRowAfter) },
    { label: '在左边插入一列', icon: 'fa-solid fa-arrow-left-long', run: () => applyCommand(view, addColumnBefore) },
    { label: '在右边插入一列', icon: 'fa-solid fa-arrow-right-long', run: () => applyCommand(view, addColumnAfter) },
    { separator: true },
    { label: '删除行', shortcut: 'Ctrl+-', icon: 'fa-regular fa-trash-can', run: () => applyCommand(view, deleteRow) },
    { label: '删除列', shortcut: 'Ctrl+Shift+-', icon: 'fa-regular fa-trash-can', run: () => applyCommand(view, deleteColumn) },
    { separator: true },
    {
      label: '更多',
      icon: 'fa-solid fa-ellipsis',
      submenu: [
        { label: '合并单元格', run: () => applyCommand(view, mergeSelectedCells) },
        { label: '使用默认对齐', run: () => applyAlignment(view, null) },
        { separator: true },
        { label: '删除表格', icon: 'fa-regular fa-trash-can', run: () => applyCommand(view, deleteTableCommand) },
      ],
    },
  ];
}

function panelEntries(view: EditorView): MenuEntry[] {
  return [
    { label: '合并单元格', icon: 'fa-solid fa-object-group', run: () => applyCommand(view, mergeSelectedCells) },
    { separator: true },
    { label: '左居', shortcut: 'Alt+L', icon: 'fa-solid fa-align-left', run: () => applyAlignment(view, 'left') },
    { label: '居中', shortcut: 'Alt+C', icon: 'fa-solid fa-align-center', run: () => applyAlignment(view, 'center') },
    { label: '居右', shortcut: 'Alt+R', icon: 'fa-solid fa-align-right', run: () => applyAlignment(view, 'right') },
    { label: '使用默认对齐', run: () => applyAlignment(view, null) },
    { separator: true },
    { label: '复制纯文本', icon: 'fa-solid fa-font', run: () => void copySelection(view, 'text') },
    { label: '复制', shortcut: 'Ctrl+C', icon: 'fa-regular fa-copy', run: () => void copySelection(view, 'rich') },
    { label: '剪切', shortcut: 'Ctrl+X', icon: 'fa-solid fa-scissors', run: () => void cutSelection(view) },
    { label: '清空', shortcut: 'Delete', icon: 'fa-regular fa-trash-can', run: () => {
      const block = collectCellBlock(view.state);
      if (block) clearCells(view, block);
    } },
    { label: '粘贴', shortcut: 'Ctrl+V', icon: 'fa-regular fa-paste', run: () => void pasteIntoSelection(view, 'rich') },
  ];
}

export function syncTablePanel(view: EditorView): void {
  lastView = view;
  const selection = view.state.selection;
  if (menuEl || !(selection instanceof CellSelection) || !view.hasFocus()) {
    closeTablePanel();
    return;
  }
  const cells = view.dom.querySelectorAll<HTMLElement>('.selectedCell');
  if (!cells.length) {
    closeTablePanel();
    return;
  }

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  cells.forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  });
  if (!Number.isFinite(left)) {
    closeTablePanel();
    return;
  }

  if (!panelEl) {
    panelEl = buildMenu('note-table-menu note-table-panel', panelEntries(view), (run) => run?.());
    document.body.appendChild(panelEl);
    const listeners = new AbortController();
    window.addEventListener('scroll', closeTablePanel, { capture: true, signal: listeners.signal });
    window.addEventListener('resize', closeTablePanel, { signal: listeners.signal });
    panelCleanup = listeners;
  }

  const rect = panelEl.getBoundingClientRect();
  const x = Math.max(8, Math.min(left + (right - left) / 2 - rect.width / 2, window.innerWidth - rect.width - 8));
  let y = top - rect.height - 8;
  if (y < 8) y = Math.min(window.innerHeight - rect.height - 8, bottom + 8);
  panelEl.style.left = `${x}px`;
  panelEl.style.top = `${y}px`;
}

export function openTableMenu(view: EditorView, event: MouseEvent): boolean {
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coords) return false;
  let $pos = view.state.doc.resolve(coords.inside >= 0 ? coords.inside : coords.pos);
  if (!cellAround($pos)) $pos = view.state.doc.resolve(coords.pos);
  if (!cellAround($pos)) return false;

  const selection = view.state.selection;
  const insideSelection = selection instanceof CellSelection
    && coords.pos >= selection.from
    && coords.pos <= selection.to;
  if (!insideSelection) {
    const next = TextSelection.near($pos);
    view.dispatch(view.state.tr.setSelection(next));
  }

  closeTableMenu();
  const menu = buildMenu('note-table-menu', cellMenuEntries(view), (run) => {
    closeTableMenu();
    run?.();
  });
  document.body.appendChild(menu);
  placeMenu(menu, event.clientX, event.clientY);
  menuEl = menu;
  closeTablePanel();

  const listeners = new AbortController();
  document.addEventListener(
    'pointerdown',
    (pointerEvent) => {
      if (menu.contains(pointerEvent.target as Node | null)) return;
      closeTableMenu();
    },
    { capture: true, signal: listeners.signal },
  );
  document.addEventListener(
    'keydown',
    (keyEvent) => {
      if (keyEvent.key === 'Escape') closeTableMenu();
    },
    { capture: true, signal: listeners.signal },
  );
  window.addEventListener('scroll', closeTableMenu, { capture: true, signal: listeners.signal });
  window.addEventListener('resize', closeTableMenu, { signal: listeners.signal });
  window.addEventListener('blur', closeTableMenu, { signal: listeners.signal });
  menuCleanup = listeners;
  lastView = view;
  return true;
}

export const tablePanelPlugin = $prose(() => new Plugin({
  key: new PluginKey('DOCK_TABLE_PANEL'),
  view: () => ({
    update: (view) => syncTablePanel(view),
    destroy: () => closeTablePanel(),
  }),
  props: {
    handleDOMEvents: {
      blur: () => {
        closeTablePanel();
        return false;
      },
    },
  },
}));

/* ---------------- 表格左上角拖拽手柄 ---------------- */

const DRAG_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M12 4.5v15M3.5 12h17"/></svg>`;

interface DragState {
  pos: number;
  node: PMNode;
  startX: number;
  startY: number;
  moved: boolean;
}

function findTableNode(view: EditorView, wrapper: HTMLElement): { pos: number; node: PMNode } | null {
  let found: { pos: number; node: PMNode } | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name !== 'table') return true;
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement && (dom === wrapper || dom.contains(wrapper) || wrapper.contains(dom))) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

function tableAtPoint(view: EditorView, wrapper: HTMLElement): { pos: number; node: PMNode } | null {
  const rect = wrapper.getBoundingClientRect();
  const coords = view.posAtCoords({ left: rect.left + 6, top: rect.top + 6 });
  if (!coords) return null;
  const $pos = view.state.doc.resolve(coords.pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === 'table') {
      return { pos: $pos.before(depth), node: $pos.node(depth) };
    }
  }
  return null;
}

/** 找到鼠标 Y 对应的顶层块边界（表格只能在同一层内容之间移动） */
function findDropTarget(view: EditorView, clientY: number): { pos: number; top: number } | null {
  let target: { pos: number; top: number } | null = null;
  view.state.doc.forEach((node, offset) => {
    const dom = view.nodeDOM(offset);
    if (!(dom instanceof HTMLElement)) return;
    const rect = dom.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      if (!target) target = { pos: offset, top: rect.top };
    } else {
      target = { pos: offset + node.nodeSize, top: rect.bottom };
    }
  });
  return target;
}

function moveTable(view: EditorView, drag: DragState, dropPos: number): void {
  const { pos, node } = drag;
  if (dropPos === pos || dropPos === pos + node.nodeSize) return;
  const target = dropPos > pos ? dropPos - node.nodeSize : dropPos;
  const tr = view.state.tr.delete(pos, pos + node.nodeSize);
  const at = Math.max(0, Math.min(target, tr.doc.content.size));
  tr.insert(at, node);
  tr.setSelection(Selection.near(tr.doc.resolve(at)));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

function installTableDrag(view: EditorView): { destroy: () => void } {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'note-table-drag';
  handle.title = '拖动表格';
  handle.setAttribute('aria-label', '拖动表格');
  handle.innerHTML = DRAG_ICON;
  handle.style.display = 'none';
  document.body.appendChild(handle);

  const indicator = document.createElement('div');
  indicator.className = 'note-table-drop';
  indicator.style.display = 'none';
  document.body.appendChild(indicator);

  let hovered: HTMLElement | null = null;
  let hideTimer = 0;
  let drag: DragState | null = null;

  const showHandle = (wrapper: HTMLElement): void => {
    hovered = wrapper;
    window.clearTimeout(hideTimer);
    const rect = wrapper.getBoundingClientRect();
    handle.style.display = 'flex';
    handle.style.left = `${Math.max(4, rect.left - 26)}px`;
    handle.style.top = `${rect.top - 1}px`;
  };

  const scheduleHide = (delay = 140): void => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (drag) return;
      handle.style.display = 'none';
      hovered = null;
    }, delay);
  };

  const onEditorMove = (event: PointerEvent): void => {
    if (drag) return;
    const target = event.target as Element | null;
    const wrapper = target?.closest?.('.tableWrapper') as HTMLElement | null;
    if (wrapper && view.dom.contains(wrapper)) {
      showHandle(wrapper);
      return;
    }
    if (handle.style.display !== 'none') scheduleHide();
  };

  const onEditorLeave = (): void => scheduleHide();
  const onScroll = (): void => {
    if (!drag) scheduleHide(0);
  };

  const onHandleEnter = (): void => window.clearTimeout(hideTimer);
  const onHandleLeave = (): void => {
    if (!drag) scheduleHide();
  };

  function cleanupDrag(): void {
    drag = null;
    handle.classList.remove('dragging');
    handle.style.display = 'none';
    indicator.style.display = 'none';
    hovered = null;
    document.removeEventListener('pointermove', onDragMove, true);
    document.removeEventListener('pointerup', onDragEnd, true);
    document.removeEventListener('keydown', onDragKey, true);
  }

  function onDragMove(event: PointerEvent): void {
    if (!drag) return;
    event.preventDefault();
    if (!drag.moved && Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    handle.style.left = `${event.clientX - 11}px`;
    handle.style.top = `${event.clientY - 11}px`;
    const target = findDropTarget(view, event.clientY);
    if (!target) {
      indicator.style.display = 'none';
      return;
    }
    const root = view.dom.getBoundingClientRect();
    indicator.style.display = 'block';
    indicator.style.left = `${root.left}px`;
    indicator.style.width = `${root.width}px`;
    indicator.style.top = `${Math.max(4, target.top - 1)}px`;
  }

  function onDragEnd(event: PointerEvent): void {
    if (!drag) return;
    const current = drag;
    const target = current.moved ? findDropTarget(view, event.clientY) : null;
    cleanupDrag();
    if (current.moved && target) moveTable(view, current, target.pos);
  }

  function onDragKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && drag) {
      event.preventDefault();
      cleanupDrag();
    }
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !hovered) return;
    const found = findTableNode(view, hovered) ?? tableAtPoint(view, hovered);
    if (!found) return;
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(hideTimer);
    drag = {
      pos: found.pos,
      node: found.node,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    handle.classList.add('dragging');
    document.addEventListener('pointermove', onDragMove, true);
    document.addEventListener('pointerup', onDragEnd, true);
    document.addEventListener('keydown', onDragKey, true);
  };

  view.dom.addEventListener('pointermove', onEditorMove);
  view.dom.addEventListener('pointerleave', onEditorLeave);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
  handle.addEventListener('pointerenter', onHandleEnter);
  handle.addEventListener('pointerleave', onHandleLeave);
  handle.addEventListener('pointerdown', onPointerDown);

  return {
    destroy: () => {
      cleanupDrag();
      window.clearTimeout(hideTimer);
      view.dom.removeEventListener('pointermove', onEditorMove);
      view.dom.removeEventListener('pointerleave', onEditorLeave);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      handle.remove();
      indicator.remove();
    },
  };
}

export const tableDragPlugin = $prose(() => new Plugin({
  key: new PluginKey('DOCK_TABLE_DRAG'),
  view: (view) => installTableDrag(view),
}));
