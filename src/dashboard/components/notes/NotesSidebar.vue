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
          <i class="fa-solid fa-folder-plus"></i>
        </button>
      </div>
    </div>

    <div class="sidebar-search">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input
        v-model="query"
        class="search-input"
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
          <div v-for="book in localBooks" :key="book.id" class="book-group">
            <div
              class="book-row"
              :class="{ active: book.id === activeBookId }"
              @click="toggleBook(book.id)"
            >
              <i class="fa-solid arrow" :class="expanded[book.id] ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
              <i class="fa-solid fa-book book-icon"></i>
              <span class="book-name" :title="book.name">{{ book.name }}</span>
              <span class="book-count">{{ store.notesForNotebook(book.id).length }}</span>
              <button class="mini-btn row-action" title="新建笔记" @click.stop="onCreateNote(book.id)">
                <i class="fa-solid fa-plus"></i>
              </button>
              <button class="mini-btn row-action" title="重命名" @click.stop="onRenameNotebook(book)">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button
                class="mini-btn row-action danger"
                title="删除笔记本"
                :disabled="!store.canDeleteNotebook"
                @click.stop="onDeleteNotebook(book)"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div v-if="expanded[book.id]" class="note-list">
              <VueDraggable
                v-if="(localNotes[book.id] ?? []).length"
                v-model="localNotes[book.id]"
                class="note-drag-list"
                :animation="160"
                ghost-class="drag-ghost"
                handle=".note-row"
                @start="draggingNotes = true"
                @end="onNoteDragEnd(book.id, $event)"
              >
                <div
                  v-for="note in localNotes[book.id]"
                  :key="note.id"
                  class="note-row"
                  :class="{ active: note.id === store.activeId }"
                  @click="onSelectNote(note.id)"
                >
                  <i class="fa-regular fa-file-lines note-icon"></i>
                  <span class="note-title">{{ note.title || '未命名笔记' }}</span>
                  <span class="note-time">{{ relativeTime(note.updatedAt) }}</span>
                  <button class="mini-btn note-delete" title="删除笔记" @click.stop="onDeleteNote(note)">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </VueDraggable>
              <div v-else class="empty-hint note-empty">暂无笔记</div>
            </div>
          </div>
        </VueDraggable>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
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
});

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

async function onNoteDragEnd(
  bookId: string,
  event: { oldIndex?: number; newIndex?: number },
): Promise<void> {
  const { oldIndex, newIndex } = event;
  try {
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
    const ids = (localNotes.value[bookId] ?? []).map(note => note.id);
    if (!(await props.beforeChange())) {
      await store.load();
      return;
    }
    await store.reorderNotes(bookId, ids);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
    await store.load();
  } finally {
    draggingNotes = false;
    syncLocalNotes();
  }
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
.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-size: 12px;
}
.search-input::placeholder { color: var(--ink4); }
.clear-btn { width: 20px; height: 20px; font-size: 10px; }

.sidebar-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 10px;
}
.book-list { display: flex; flex-direction: column; gap: 1px; }
.book-group { min-width: 0; }
.book-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 6px 7px 7px;
  border-radius: var(--radius-sm);
  color: var(--ink2);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.book-row:hover { background: var(--panel2); }
.book-row.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, transparent); }
.arrow { width: 10px; font-size: 8px; color: var(--ink4); flex-shrink: 0; }
.book-icon { font-size: 11px; color: var(--ink3); flex-shrink: 0; }
.book-row.active .book-icon { color: var(--accent); }
.book-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: var(--font-medium);
}
.book-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--bg2);
  color: var(--ink4);
  font-family: var(--font-mono);
  font-size: 9.5px;
  text-align: center;
  line-height: 17px;
}
.row-action { width: 22px; height: 22px; opacity: 0; font-size: 10px; }
.book-row:hover .row-action { opacity: 1; }
.note-list { padding: 1px 0 4px 12px; }
.note-drag-list { display: flex; flex-direction: column; gap: 1px; }
.note-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 7px;
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
.note-icon { font-size: 10px; color: var(--ink4); flex-shrink: 0; }
.note-row.active .note-icon { color: var(--accent); }
.note-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.note-time { font-size: 9.5px; color: var(--ink4); flex-shrink: 0; }
.note-row.active .note-time { color: color-mix(in srgb, var(--accent) 65%, var(--ink4)); }
.note-delete { width: 20px; height: 20px; opacity: 0; font-size: 9px; flex-shrink: 0; }
.note-row:hover .note-delete { opacity: 1; }
.note-delete:hover { color: var(--danger); }

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
.note-empty, .hint { padding: 10px; }
.drag-ghost { opacity: 0.45; }
</style>
