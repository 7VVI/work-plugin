<template>
  <div class="note-editor">
    <div
      ref="rootEl"
      class="crepe-host"
      @contextmenu.capture="onContextMenu"
    ></div>
    <div v-if="!ready && !error" class="editor-status">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>正在加载编辑器…</span>
    </div>
    <div v-if="error" class="editor-status editor-error">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>{{ error }}</span>
      <button class="btn-g btn-sm" @click="retry">重试</button>
    </div>

    <NoteContextMenu
      :open="menuOpen"
      :x="menuX"
      :y="menuY"
      @run="runMenuAction"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { Crepe } from '@milkdown/crepe';
import { EditorView } from '@codemirror/view';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { TextSelection, AllSelection } from '@milkdown/kit/prose/state';
import { codeBlockConfig } from '@milkdown/kit/component/code-block';
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip';
import {
  createCodeBlockCommand,
  insertHrCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';
import { useToastStore } from '@shared/stores/toastStore';
import { noteAssetRepo } from '@shared/db/repositories/noteAssetRepo';
import { assetRef } from '@shared/utils/noteAssets';
import NoteContextMenu from './NoteContextMenu.vue';
import { zhCrepeConfig, sortedCodeLanguages } from './crepeLocale';
import { imageFeatureConfig } from './crepeImages';
import { trimPastedCodeBlock, trimCodeBlockTail } from './crepePaste';
import { htmlRenderSchema, htmlRemark } from './crepeHtml';
import { noteKeyBehavior } from './crepeKeys';
import { crepeHighlightExtension } from './crepeHighlight';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import 'katex/dist/katex.min.css';
import '../../styles/notes-editor.css';

const props = defineProps<{
  initialContent: string;
}>();

const emit = defineEmits<{
  change: [markdown: string];
  ready: [];
}>();

const toast = useToastStore();
const rootEl = ref<HTMLElement | null>(null);
const ready = ref(false);
const error = ref('');
const menuOpen = ref(false);
const menuX = ref(0);
const menuY = ref(0);

let crepe: Crepe | null = null;
let creating = false;
let destroyed = false;

async function createEditor(): Promise<void> {
  if (!rootEl.value || creating) return;
  creating = true;
  ready.value = false;
  error.value = '';

  let instance: Crepe | null = null;

  try {
    rootEl.value.innerHTML = '';
    instance = new Crepe({
      root: rootEl.value,
      defaultValue: props.initialContent || '',
      features: {
        [Crepe.Feature.ImageBlock]: true,
        [Crepe.Feature.TopBar]: false,
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.BlockEdit]: true,
        [Crepe.Feature.Toolbar]: true,
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.Latex]: true,
        [Crepe.Feature.ListItem]: true,
        [Crepe.Feature.Placeholder]: true,
        [Crepe.Feature.Cursor]: true,
      },
      featureConfigs: {
        ...zhCrepeConfig,
        [Crepe.Feature.CodeMirror]: {
          ...zhCrepeConfig[Crepe.Feature.CodeMirror],
          languages: sortedCodeLanguages,
        },
        [Crepe.Feature.ImageBlock]: imageFeatureConfig,
      },
    });

    instance.on(listener => {
      listener.markdownUpdated((_ctx, markdown, previous) => {
        if (markdown !== previous) emit('change', markdown);
      });
    });

    // Crepe 默认给代码块套 One Dark 配色，这里换成与思源一致的 GitHub 浅色高亮
    instance.editor.config((ctx) => {
      ctx.update(codeBlockConfig.key, (config) => ({
        ...config,
        extensions: [crepeHighlightExtension],
      }));
    });
    // 代码围栏整段吞并、标题降级、代码块旁空行删不掉，统一在这里修正
    instance.editor.config(noteKeyBehavior);

    // 粘贴 / 新建代码块时去掉末尾多余空行
    instance.editor.use(trimPastedCodeBlock);
    // Markdown 里的行内 HTML（如思源导出的 <span style>）按 HTML 渲染
    instance.editor.use(htmlRemark).use(htmlRenderSchema);

    await instance.create();
    if (destroyed) {
      await instance.destroy();
      return;
    }
    normalizeLoadedCodeBlocks(instance);
    crepe = instance;
    ready.value = true;
    emit('ready');
  } catch (cause) {
    if (instance) await instance.destroy().catch(() => {});
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    creating = false;
  }
}

async function destroyEditor(): Promise<void> {
  const instance = crepe;
  crepe = null;
  if (instance) await instance.destroy();
}

/** 打开历史笔记时，把代码块尾部的空行也收敛掉（旧数据可能已经带上了） */
function normalizeLoadedCodeBlocks(instance: Crepe): void {
  const view = instance.editor.ctx.get(editorViewCtx);
  const tr = trimCodeBlockTail(view.state, 0, view.state.doc.content.size);
  if (tr) view.dispatch(tr);
}
function retry(): void {
  void destroyEditor().finally(() => void createEditor());
}

/** 图片块把宽高比写进了 alt，这里还原成空 alt，正文更接近通用 Markdown */
const ASSET_ALT_RE = /!\[(\d+(?:\.\d+)?)\]\((dock-asset:[^)]+)\)/g;

function getMarkdown(): string {
  const raw = crepe?.getMarkdown() ?? props.initialContent;
  return raw.replace(ASSET_ALT_RE, '![]($2)');
}

function focus(): void {
  rootEl.value?.querySelector<HTMLElement>('.ProseMirror')?.focus();
}

/* ---------- 右键菜单（参考 Typora） ---------- */

function getView() {
  return crepe?.editor.ctx.get(editorViewCtx);
}

/** 在光标处插入一张图片：二进制存本地资源表，正文只留 dock-asset 引用 */
async function insertImage(file: File): Promise<boolean> {
  const view = getView();
  if (!view) return false;
  try {
    const asset = await noteAssetRepo.save(file, file.type);
    const nodeType = view.state.schema.nodes['image-block'];
    if (!nodeType) {
      toast.error('当前编辑器不支持图片');
      return false;
    }
    const node = nodeType.createAndFill({ src: assetRef(asset.id), caption: '', ratio: 1 });
    if (!node) return false;
    view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
    view.focus();
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '图片插入失败');
    return false;
  }
}

function openMenu(event: MouseEvent): void {
  const view = getView();
  if (!view) return;
  event.preventDefault();
  event.stopPropagation();

  // 右键落在已有选区内时保留选区（Typora 行为），否则把光标移到右键处
  const selection = window.getSelection();
  let keepSelection = false;
  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    keepSelection = event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
  }

  if (!keepSelection) {
    const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (coords?.pos != null) {
      try {
        view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(coords.pos))));
      } catch {
        // 位置无法映射时保留原选区
      }
    }
  }

  menuX.value = Math.max(8, Math.min(event.clientX, window.innerWidth - 236));
  menuY.value = Math.max(8, Math.min(event.clientY, window.innerHeight - 360));
  menuOpen.value = true;
}

function closeMenu(): void {
  menuOpen.value = false;
}

function onContextMenu(event: MouseEvent): void {
  openMenu(event);
}

function onMenuDismiss(event: MouseEvent): void {
  if (!menuOpen.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest?.('.ctx-menu')) return;
  closeMenu();
}

function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '');
}

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    toast.error('无法写入剪贴板');
  }
}

async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    toast.error('无法读取剪贴板，请用 Ctrl+V 粘贴');
    return null;
  }
}

function wrapInTaskList(): void {
  const view = getView();
  if (!view) return;
  const commands = crepe?.editor.ctx.get(commandsCtx);
  commands?.call(wrapInBulletListCommand.key);

  const state = view.state;
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== 'list_item') continue;
    view.dispatch(state.tr.setNodeMarkup($from.before(depth), undefined, {
      ...node.attrs,
      checked: false,
    }));
    return;
  }
}

function applyParagraph(arg?: string): void {
  const commands = crepe?.editor.ctx.get(commandsCtx);
  if (!commands) return;
  if (!arg || arg === 'body') {
    commands.call(wrapInHeadingCommand.key, 0);
    return;
  }
  if (/^h[1-6]$/.test(arg)) {
    commands.call(wrapInHeadingCommand.key, Number(arg.slice(1)));
    return;
  }
  if (arg === 'quote') {
    commands.call(wrapInBlockquoteCommand.key);
    return;
  }
  if (arg === 'code') {
    commands.call(createCodeBlockCommand.key, '');
  }
}

function applyInsert(arg?: string): void {
  const commands = crepe?.editor.ctx.get(commandsCtx);
  if (!commands) return;
  switch (arg) {
    case 'table':
      commands.call(insertTableCommand.key, { row: 3, col: 3 });
      break;
    case 'hr':
      commands.call(insertHrCommand.key);
      break;
    case 'code':
      commands.call(createCodeBlockCommand.key, '');
      break;
    case 'math':
      // Crepe 的公式命令未对外导出，按其内部命令名调用
      commands.call('ToggleLatex');
      break;
    case 'link':
      commands.call(toggleLinkCommand.key);
      break;
  }
}

async function runMenuAction(action: string, arg?: string): Promise<void> {
  const view = getView();
  closeMenu();
  if (!view) return;

  switch (action) {
    case 'cut':
      document.execCommand('cut');
      break;
    case 'copy':
      document.execCommand('copy');
      break;
    case 'delete':
      view.dispatch(view.state.tr.deleteSelection());
      break;
    case 'paste':
      await pasteInto(view, false);
      break;
    case 'copyAs':
      if (arg === 'markdown') await writeClipboard(crepe?.getMarkdown() ?? '');
      else await writeClipboard(window.getSelection()?.toString() ?? '');
      break;
    case 'pasteAs':
      await pasteInto(view, arg !== 'text');
      break;
    case 'bold':
      crepe?.editor.ctx.get(commandsCtx).call(toggleStrongCommand.key);
      break;
    case 'italic':
      crepe?.editor.ctx.get(commandsCtx).call(toggleEmphasisCommand.key);
      break;
    case 'code':
      crepe?.editor.ctx.get(commandsCtx).call(toggleInlineCodeCommand.key);
      break;
    case 'link':
      crepe?.editor.ctx.get(commandsCtx).call(toggleLinkCommand.key);
      break;
    case 'quote':
      crepe?.editor.ctx.get(commandsCtx).call(wrapInBlockquoteCommand.key);
      break;
    case 'bullet':
      crepe?.editor.ctx.get(commandsCtx).call(wrapInBulletListCommand.key);
      break;
    case 'ordered':
      crepe?.editor.ctx.get(commandsCtx).call(wrapInOrderedListCommand.key);
      break;
    case 'task':
      wrapInTaskList();
      break;
    case 'paragraph':
      applyParagraph(arg);
      break;
    case 'insert':
      applyInsert(arg);
      break;
  }
}

async function pasteInto(view: NonNullable<ReturnType<typeof getView>>, keepMarkdown: boolean): Promise<void> {
  const text = await readClipboard();
  if (text === null) return;
  const value = keepMarkdown ? text : stripMarkdown(text);
  if (!value) return;
  const { from } = view.state.selection;
  view.dispatch(view.state.tr.insertText(value, from));
  view.focus();
}

/* ---------- 选区 ---------- */

/* ---------------- 代码块内的全选（对齐思源） ---------------- */

/**
 * 代码块是嵌套编辑器，事件会先冒泡到主编辑器，导致 Ctrl+A 全选整篇。
 * 这里在捕获阶段拦下：
 *   第一次按 → 只选代码块内容；
 *   代码块已全选时再按 → 选整篇（正文 + 代码块）。
 * 全程不调用 focus、不带 scrollIntoView，并在结束后恢复滚动位置，
 * 保证光标与视图都不跳动。
 */
type SelectAllStage = 'none' | 'code' | 'document';
let selectAllStage: SelectAllStage = 'none';

function onEditorKeyDown(event: KeyboardEvent): void {
  const isSelectAll = event.key.toLowerCase() === 'a'
    && (event.ctrlKey || event.metaKey)
    && !event.altKey
    && !event.shiftKey;
  if (!isSelectAll) {
    // 其他按键代表新的编辑意图，全选阶段重置（单独的修饰键不算）
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
      selectAllStage = 'none';
    }
    return;
  }
  const target = event.target as HTMLElement | null;
  const content = target?.closest?.('.cm-content') as HTMLElement | null;
  if (!content) return;
  event.preventDefault();
  event.stopPropagation();

  const scroller = rootEl.value?.closest('.note-scroll') as HTMLElement | null;
  const scrollTop = scroller?.scrollTop;
  window.setTimeout(() => {
    const host = (content.closest('.cm-editor') ?? content) as HTMLElement;
    const cmView = EditorView.findFromDOM(host);
    // 已经是整篇选中时再次按，保持整篇选中不变
    const wholeSelected = selectAllStage === 'document'
      || selectAllStage === 'code'
      || isCodeBlockFullySelected(content, cmView);
    if (wholeSelected) {
      selectWholeDocument(cmView, content);
      selectAllStage = 'document';
    } else {
      selectCodeBlockContent(cmView, content);
      selectAllStage = 'code';
    }
    if (scroller && scrollTop !== undefined) scroller.scrollTop = scrollTop;
  }, 0);
}

/** 鼠标点击后光标位置改变，全选阶段重置 */
function onEditorMouseDown(): void {
  selectAllStage = 'none';
}

/** 代码块当前是否已经全选 */
function isCodeBlockFullySelected(content: HTMLElement, cmView: EditorView | null): boolean {
  if (cmView) {
    // CodeMirror 的 EditorSelection 上没有 from/to，实际范围在 main 上
    const main = cmView.state.selection.main as { empty?: boolean; from?: number; to?: number };
    if (typeof main.from !== 'number' || typeof main.to !== 'number') return false;
    return main.empty === false
      && main.from === 0
      && main.to === cmView.state.doc.length;
  }
  const native = window.getSelection();
  if (!native || native.isCollapsed || !native.rangeCount) return false;
  if (!native.anchorNode || !content.contains(native.anchorNode)) return false;
  return native.toString().trim() === (content.innerText || '').trim();
}

/** 只选代码块内容：不动光标、不滚动 */
function selectCodeBlockContent(cmView: EditorView | null, content: HTMLElement): void {
  if (cmView) {
    cmView.dispatch({ selection: { anchor: 0, head: cmView.state.doc.length } });
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(content);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** 选整篇：代码块内部保持全选，主编辑器选区覆盖全文 */
function selectWholeDocument(cmView: EditorView | null, content: HTMLElement): void {
  const view = getView();
  if (view) {
    try {
      // 用 AllSelection：TextSelection 落在文档边界会触发
      // "TextSelection endpoint not pointing into a node with inline content"
      const { state } = view;
      view.dispatch(state.tr.setSelection(new AllSelection(state.doc)));
    } catch {
      // 极端文档结构下选区创建可能失败，下面仍会用原生选区铺满
    }
  }

  // 代码块内部保持全选（CodeMirror 自己的选区图层）
  selectCodeBlockContent(cmView, content);

  // 主编辑器没有焦点时 ProseMirror 不会更新 DOM 选区，这里手动把原生选区铺满
  const editable = view
    ? (view.dom.matches('.ProseMirror')
      ? view.dom
      : view.dom.querySelector<HTMLElement>('.ProseMirror')) ?? view.dom
    : null;
  if (!editable) return;
  const range = document.createRange();
  range.selectNodeContents(editable);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

onMounted(async () => {
  await nextTick();
  rootEl.value?.addEventListener('keydown', onEditorKeyDown, true);
  rootEl.value?.addEventListener('mousedown', onEditorMouseDown, true);
  document.addEventListener('mousedown', onMenuDismiss, true);
  document.addEventListener('keydown', onMenuKeydown, true);
  await createEditor();
});

onBeforeUnmount(() => {
  rootEl.value?.removeEventListener('keydown', onEditorKeyDown, true);
  rootEl.value?.removeEventListener('mousedown', onEditorMouseDown, true);
  document.removeEventListener('mousedown', onMenuDismiss, true);
  document.removeEventListener('keydown', onMenuKeydown, true);
  closeMenu();
  destroyed = true;
  void destroyEditor();
});

defineExpose({ getMarkdown, focus, insertImage });
</script>

<style scoped>
.note-editor {
  position: relative;
  min-height: 360px;
}
.crepe-host {
  min-height: 360px;
}
.editor-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 60px 20px;
  color: var(--ink3);
  font-size: 12px;
}
.editor-status i { color: var(--accent); }
.editor-error {
  flex-direction: column;
  color: var(--danger);
}
.editor-error i { color: var(--danger); font-size: 20px; }
</style>
