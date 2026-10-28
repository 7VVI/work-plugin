<template>
  <aside class="notes-sidebar">
    <div class="sidebar-head">
      <div class="sidebar-title">
        <i class="fa-solid fa-book-open"></i>
        <span>笔记</span>
      </div>
      <div class="head-actions">
        <button class="mini-btn" title="新建笔记" @click="onCreateNote(activeBookId ?? localBooks[0]?.id)">
          <i class="fa-solid fa-file-circle-plus"></i>
        </button>
        <button class="mini-btn" title="新建笔记本" @click="onCreateNotebook">
          <i class="fa-solid fa-folder-plus folder-action"></i>
        </button>
      </div>
    </div>

    <div class="sidebar-search">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input
        v-model="query"
        class="sidebar-search-input"
        placeholder="搜索标题或正文…"
        @input="onSearchInput"
      />
      <button v-if="query" class="mini-btn clear-btn" title="清除搜索" @click="clearSearch">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="sidebar-body">
      <template v-if="store.searchQuery.trim()">
        <div v-if="store.searching" class="hint">搜索中…</div>
        <button
          v-for="result in store.searchResults"
          :key="result.note.id"
          class="search-item"
          :class="{ active: result.note.id === store.activeId }"
          @click="onSelectNote(result.note.id)"
        >
          <span class="search-book">{{ store.bookName(result.note.notebookId) }}</span>
          <span class="search-title">{{ result.note.title || '未命名笔记' }}</span>
          <span v-if="result.snippet" class="search-snippet">{{ result.snippet }}</span>
        </button>
        <div v-if="!store.searching && store.searchResults.length === 0" class="empty-hint">
          未找到匹配的笔记
        </div>
      </template>

      <template v-else>
        <div v-if="localBooks.length === 0" class="empty-state">
          <i class="fa-regular fa-folder-open"></i>
          <p>还没有笔记本</p>
          <button class="btn-p btn-sm" @click="onCreateNotebook">创建第一个笔记本</button>
        </div>

        <VueDraggable
          v-else
          :model-value="localBooks"
          class="book-list"
          :animation="180"
          ghost-class="drag-ghost"
          handle=".book-row"
          :filter="'.mini-btn'"
          :prevent-on-filter="false"
          @end="onBookDragEnd"
        >
          <div v-for="book in localBooks" :key="book.id" class="book-group" :data-notebook-id="book.id">
            <div
              class="book-row"
              :class="{ 'has-active': book.id === activeBookId }"
              @click="toggleBook(book.id)"
            >
              <i class="fa-solid arrow" :class="expanded[book.id] ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
              <i class="fa-regular book-icon" :class="expanded[book.id] ? 'fa-folder-open' : 'fa-folder'"></i>
              <span class="book-name" :title="book.name">{{ book.name }}</span>
              <button class="mini-btn row-action" title="新建笔记" @click.stop="onCreateNote(book.id)">
                <i class="fa-solid fa-plus"></i>
              </button>
              <button class="mini-btn row-action" title="更多" @click.stop="openBookMenu($event, book)">
                <i class="fa-solid fa-ellipsis"></i>
              </button>
            </div>

            <div v-if="expanded[book.id]" class="note-list">
              <VueDraggable
                v-model="localNotes[book.id]"
                class="note-drag-list"
                :animation="160"
                ghost-class="drag-ghost"
                group="notes"
                draggable=".note-row"
                handle=".note-row"
                :filter="'.mini-btn'"
                :prevent-on-filter="false"
                @start="onNoteDragStart"
                @end="onNoteDragEnd"
              >
                <div
                  v-for="note in localNotes[book.id]"
                  :key="note.id"
                  class="note-row"
                  :class="{ active: note.id === store.activeId }"
                  :data-note-id="note.id"
                  @click="onSelectNote(note.id)"
                >
                  <i class="fa-regular fa-file note-icon"></i>
                  <span class="note-title" :title="noteTip(note)">{{ note.title || '未命名笔记' }}</span>
                  <button class="mini-btn note-more" title="更多" @click.stop="openNoteMenu($event, note)">
                    <i class="fa-solid fa-ellipsis"></i>
                  </button>
                </div>
              </VueDraggable>
            </div>
          </div>
        </VueDraggable>
      </template>
    </div>

    <div class="sidebar-foot">
      <button class="foot-btn" title="新建笔记" @click="onCreateNote(activeBookId ?? localBooks[0]?.id)">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="menu"
        class="tree-menu"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        @click.stop
        @contextmenu.prevent
      >
        <button
          v-for="item in menu.items"
          :key="item.label"
          class="tree-menu-item"
          :class="{ danger: item.danger }"
          @click="runMenuItem(item)"
        >
          <i v-if="item.icon" class="fa-solid" :class="item.icon"></i>
          <span>{{ item.label }}</span>
        </button>
      </div>
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useNoteStore, type NoteSummary } from '@shared/stores/noteStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useToastStore } from '@shared/stores/toastStore';
import { formatRelativeTime } from '@shared/utils/time';
import { LastNotebookError } from '@shared/db/repositories/noteBookRepo';
import type { NoteBook } from '@shared/types/entities';

const props = defineProps<{
  beforeChange: () => Promise<boolean>;
}>();

const store = useNoteStore();
const dialog = useDialogStore();
const toast = useToastStore();

const query = ref('');
const expanded = ref<Record<string, boolean>>({});
const localBooks = ref<NoteBook[]>([]);
const localNotes = ref<Record<string, NoteSummary[]>>({});
let searchTimer: number | undefined;
let draggingNotes = false;

interface TreeMenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  run: () => void | Promise<void>;
}

const menu = ref<{ x: number; y: number; items: TreeMenuItem[] } | null>(null);

const activeBookId = computed(() => store.activeNote?.notebookId ?? null);

function syncLocalNotes(): void {
  const next: Record<string, NoteSummary[]> = {};
  for (const book of localBooks.value) next[book.id] = store.notesForNotebook(book.id);
  localNotes.value = next;
}

watch(
  () => store.noteBooks,
  books => {
    localBooks.value = books.map(book => ({ ...book }));
    syncLocalNotes();
  },
  { immediate: true, deep: true },
);

watch(
  () => store.notes,
  () => {
    if (!draggingNotes) syncLocalNotes();
  },
  { deep: true },
);

watch(
  () => store.activeNote?.notebookId,
  id => {
    if (id) expanded.value = { ...expanded.value, [id]: true };
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (searchTimer) window.clearTimeout(searchTimer);
  document.removeEventListener('mousedown', onDocumentMouseDown, true);
  document.removeEventListener('keydown', onDocumentKeydown, true);
});

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown, true);
  document.addEventListener('keydown', onDocumentKeydown, true);
});

function onDocumentMouseDown(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (target?.closest?.('.tree-menu')) return;
  closeMenu();
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu();
}

function closeMenu(): void {
  menu.value = null;
}

function openMenu(event: MouseEvent, items: TreeMenuItem[]): void {
  event.stopPropagation();
  const width = 132;
  const height = items.length * 28 + 8;
  menu.value = {
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
    items,
  };
}

async function runMenuItem(item: TreeMenuItem): Promise<void> {
  closeMenu();
  await item.run();
}

function openBookMenu(event: MouseEvent, book: NoteBook): void {
  openMenu(event, [
    { label: '新建笔记', icon: 'fa-plus', run: () => onCreateNote(book.id) },
    { label: '重命名', icon: 'fa-pen', run: () => onRenameNotebook(book) },
    {
      label: '删除笔记本',
      icon: 'fa-trash',
      danger: true,
      run: () => onDeleteNotebook(book),
    },
  ]);
}

function openNoteMenu(event: MouseEvent, note: NoteSummary): void {
  openMenu(event, [
    { label: '删除笔记', icon: 'fa-trash', danger: true, run: () => onDeleteNote(note) },
  ]);
}

function toggleBook(id: string): void {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] };
}

function onSearchInput(): void {
  if (searchTimer) window.clearTimeout(searchTimer);
  if (!query.value.trim()) {
    void store.search('');
    return;
  }
  searchTimer = window.setTimeout(() => void store.search(query.value), 200);
}

function clearSearch(): void {
  if (searchTimer) window.clearTimeout(searchTimer);
  query.value = '';
  void store.search('');
}

function relativeTime(timestamp: number): string {
  return formatRelativeTime(timestamp);
}

/** 树里不显示时间，悬停提示里补充更新时间 */
function noteTip(note: NoteSummary): string {
  const title = note.title || '未命名笔记';
  return `${title} · ${relativeTime(note.updatedAt)}`;
}

async function onSelectNote(id: string): Promise<void> {
  if (id === store.activeId) return;
  if (!(await props.beforeChange())) return;
  const ok = await store.select(id);
  if (ok) {
    const bookId = store.activeNote?.notebookId;
    if (bookId) expanded.value = { ...expanded.value, [bookId]: true };
  }
}

async function onCreateNote(bookId?: string): Promise<void> {
  if (!(await props.beforeChange())) return;
  clearSearch();
  try {
    const id = await store.createNote(bookId);
    if (id) {
      const target = store.activeNote?.notebookId;
      if (target) expanded.value = { ...expanded.value, [target]: true };
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function onCreateNotebook(): Promise<void> {
  const name = await dialog.prompt('新建笔记本', '笔记本名称');
  if (!name) return;
  try {
    const id = await store.createNotebook(name);
    expanded.value = { ...expanded.value, [id]: true };
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function onRenameNotebook(book: NoteBook): Promise<void> {
  const name = await dialog.prompt('重命名笔记本', '笔记本名称', book.name);
  if (!name || name === book.name) return;
  try {
    await store.renameNotebook(book.id, name);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function onDeleteNotebook(book: NoteBook): Promise<void> {
  if (!store.canDeleteNotebook) {
    toast.error('至少保留一个笔记本');
    return;
  }
  const count = store.notesForNotebook(book.id).length;
  const ok = await dialog.confirm(
    `删除笔记本「${book.name}」`,
    count > 0 ? `将同时删除 ${count} 篇笔记，且不可恢复。` : '确定删除这个笔记本？',
  );
  if (!ok) return;
  try {
    await store.deleteNotebook(book.id);
  } catch (error) {
    if (error instanceof LastNotebookError) toast.error(error.message);
    else toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function onDeleteNote(note: NoteSummary): Promise<void> {
  const active = note.id === store.activeId;
  const ok = await dialog.confirm(
    '删除笔记',
    active
      ? '当前笔记的未保存内容会丢失，确定删除？'
      : `确定删除「${note.title || '未命名笔记'}」？`,
  );
  if (!ok) return;
  try {
    await store.deleteNote(note.id);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function onBookDragEnd(event: { oldIndex?: number; newIndex?: number }): Promise<void> {
  const { oldIndex, newIndex } = event;
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
  const list = [...localBooks.value];
  const [moved] = list.splice(oldIndex, 1);
  if (!moved) return;
  list.splice(newIndex, 0, moved);
  try {
    await store.reorderNotebooks(list.map(book => book.id));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
    await store.load();
  }
}

async function onNoteDragEnd(event: {
  oldIndex?: number;
  newIndex?: number;
  from?: HTMLElement;
  to?: HTMLElement;
  item?: HTMLElement;
}): Promise<void> {
  finishNoteDrag();
  try {
    const { oldIndex, newIndex, from, to, item } = event;
    if (newIndex === undefined) return;
    const sourceBookId = from?.closest('[data-notebook-id]')?.getAttribute('data-notebook-id');
    const targetBookId = to?.closest('[data-notebook-id]')?.getAttribute('data-notebook-id');
    const noteId = item?.dataset.noteId;
    if (!sourceBookId || !targetBookId || !noteId) return;

    if (sourceBookId === targetBookId) {
      if (oldIndex === newIndex) return;
      const ids = (localNotes.value[sourceBookId] ?? []).map(note => note.id);
      await store.reorderNotes(sourceBookId, ids);
      toast.success('笔记排序已更新');
      return;
    }

    await store.moveNote(noteId, targetBookId, newIndex);
    toast.success(`笔记已移动到「${store.bookName(targetBookId)}」`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
    await store.load();
  } finally {
    draggingNotes = false;
    syncLocalNotes();
  }
}

/* 拖动时悬停折叠的笔记本，短暂停留后展开，方便把它拖进去 */
let draggingNote = false;
let expandTimer: number | undefined;
let pendingExpandBookId: string | null = null;

function cancelPendingExpand(): void {
  if (expandTimer) {
    window.clearTimeout(expandTimer);
    expandTimer = undefined;
  }
  pendingExpandBookId = null;
}

function handleNoteDragOver(e: DragEvent | MouseEvent): void {
  if (!draggingNote) return;
  // mousemove 兜底非原生拖拽，避免鼠标已松开仍触发展开
  if (e.type === 'mousemove' && (e as MouseEvent).buttons === 0) return;

  const target = document.elementFromPoint(e.clientX, e.clientY);
  const group = target?.closest('.book-group') as HTMLElement | null;
  const bookId = group?.dataset.notebookId;
  if (!bookId || expanded.value[bookId]) {
    cancelPendingExpand();
    return;
  }
  if (pendingExpandBookId === bookId) return;
  cancelPendingExpand();
  pendingExpandBookId = bookId;
  expandTimer = window.setTimeout(() => {
    expandTimer = undefined;
    if (!draggingNote || pendingExpandBookId !== bookId) return;
    expanded.value = { ...expanded.value, [bookId]: true };
    pendingExpandBookId = null;
  }, 250);
}

function finishNoteDrag(): void {
  draggingNote = false;
  cancelPendingExpand();
  document.removeEventListener('dragover', handleNoteDragOver, true);
  document.removeEventListener('mousemove', handleNoteDragOver, true);
  document.removeEventListener('mouseup', finishNoteDrag, true);
  document.removeEventListener('dragend', finishNoteDrag, true);
}

function onNoteDragStart(): void {
  draggingNotes = true;
  if (draggingNote) return;
  draggingNote = true;
  document.addEventListener('dragover', handleNoteDragOver, true);
  document.addEventListener('mousemove', handleNoteDragOver, true);
  document.addEventListener('mouseup', finishNoteDrag, true);
  document.addEventListener('dragend', finishNoteDrag, true);
}
</script>

<style scoped>
.notes-sidebar {
  width: 280px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--panel);
  overflow: hidden;
}
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sidebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--ink);
}
.sidebar-title i { color: var(--accent); font-size: 13px; }
.head-actions { display: flex; align-items: center; gap: 2px; }
.mini-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.12s ease, color 0.12s ease;
}
.mini-btn:hover { background: var(--panel2); color: var(--ink); }
.mini-btn.danger:hover { color: var(--danger); }
.mini-btn:disabled { opacity: 0.35; cursor: not-allowed; }
/* 新建笔记本用与列表一致的暖黄文件夹，突出"笔记本"语义 */
.mini-btn .folder-action { color: #d3a13c; }
.mini-btn:hover .folder-action { color: #c08f2c; }

.sidebar-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 10px 12px 8px;
  padding: 0 9px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg2);
  color: var(--ink3);
}
.sidebar-search:focus-within { border-color: var(--accent); box-shadow: var(--shadow-focus); }
.sidebar-search > i { font-size: 11px; }
/* 不复用全局 .search-input（它自带边框与聚焦光晕，会和外层搜索框叠成双层框） */
.sidebar-search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-size: 12px;
}
.sidebar-search-input::placeholder { color: var(--ink4); }
.clear-btn { width: 20px; height: 20px; font-size: 10px; }

.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 6px 10px;
}
.book-list { display: flex; flex-direction: column; gap: 1px; }
.book-group { min-width: 0; }

/* 树行样式对齐思源文档树：图标 + 名称，行高 28px，操作按钮悬停才出现 */
.book-row {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 4px 0 2px;
  border-radius: var(--radius-sm);
  color: var(--ink);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.book-row:hover { background: var(--panel2); }
/* 选中的是文件夹下的笔记时，文件夹本身不再显示选中蓝，保持父节点字色 */
.book-row.has-active { color: var(--ink); }
.arrow { width: 11px; font-size: 8px; color: var(--ink4); flex-shrink: 0; }
.book-icon { font-size: 12px; color: #d3a13c; flex-shrink: 0; }
.book-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: var(--font-medium);
}
.row-action { width: 22px; height: 22px; opacity: 0; font-size: 10px; }
.book-row:hover .row-action,
.book-row:focus-within .row-action { opacity: 1; }
/* 子级缩进到笔记本名字那一列（箭头 11 + 间隔 5 + 图标 12 + 间隔 5 + 行内边距 2） */
.note-list {
  position: relative;
  padding: 1px 0 3px 32px;
}
/* 子级引导线，强化层级（思源的文档树同样有缩进层次） */
.note-list::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 3px;
  bottom: 4px;
  width: 1px;
  background: var(--border);
}
.note-drag-list { display: flex; flex-direction: column; gap: 1px; }
/* 空笔记本保留一行无内容的落区，方便直接把笔记拖进去 */
.note-drag-list:empty { min-height: 28px; }
.note-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 4px 0 3px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink2);
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.note-row:hover { background: var(--panel2); color: var(--ink); }
.note-row.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, transparent); }
.note-icon { font-size: 11px; color: #6f96cc; flex-shrink: 0; }
.note-row.active .note-icon { color: var(--accent); }
.note-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.note-more { width: 22px; height: 22px; opacity: 0; font-size: 10px; flex-shrink: 0; }
.note-row:hover .note-more,
.note-row:focus-within .note-more { opacity: 1; }

.sidebar-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-top: 1px solid var(--border);
}
.foot-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  font-size: 11px;
  transition: background 0.12s ease, color 0.12s ease;
}
.foot-btn:hover { background: var(--panel2); color: var(--ink); }

/* 树行「更多」菜单（对齐思源右键菜单的紧凑样式） */
.tree-menu {
  position: fixed;
  z-index: 400;
  min-width: 128px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
  box-shadow: var(--shadow-lg);
}
.tree-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink2);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.tree-menu-item:hover { background: var(--panel2); color: var(--ink); }
.tree-menu-item.danger:hover { color: var(--danger); }
.tree-menu-item i { width: 12px; font-size: 10px; text-align: center; }

.search-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 9px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink2);
  text-align: left;
  cursor: pointer;
}
.search-item:hover { background: var(--panel2); }
.search-item.active { background: color-mix(in srgb, var(--accent) 9%, transparent); }
.search-book { font-size: 9.5px; color: var(--ink4); }
.search-title { font-size: 12.5px; font-weight: var(--font-medium); color: var(--ink); }
.search-item.active .search-title { color: var(--accent); }
.search-snippet {
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--ink3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.empty-state, .empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 14px;
  color: var(--ink4);
  font-size: 11.5px;
  text-align: center;
}
.empty-state i { font-size: 24px; color: var(--ink4); }
.empty-state p { margin: 0; }
.hint { padding: 10px; }
.drag-ghost { opacity: 0.45; }
</style>
