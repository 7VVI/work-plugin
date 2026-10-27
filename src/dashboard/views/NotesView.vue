<template>
  <div class="notes-view">
    <div v-if="sidebarOpen" class="mobile-backdrop" @click="sidebarOpen = false"></div>
    <NotesSidebar
      :class="{ 'mobile-open': sidebarOpen }"
      :before-change="flushSave"
    />

    <section class="note-main">
      <template v-if="store.activeNote">
        <header class="note-bar">
          <button class="mobile-nav-btn" title="笔记列表" @click="sidebarOpen = true">
            <i class="fa-solid fa-bars"></i>
          </button>
          <div class="breadcrumb">
            <span class="crumb-book">{{ store.bookName(store.activeNote.notebookId) }}</span>
            <i class="fa-solid fa-chevron-right crumb-sep"></i>
            <span class="crumb-note">{{ displayTitle }}</span>
          </div>
          <div class="note-actions">
            <span class="save-state" :class="saveStateClass">{{ saveStateText }}</span>
            <button
              class="note-action-btn outline-toggle"
              :class="{ active: outlineOpen }"
              title="大纲"
              @click="toggleOutline"
            >
              <i class="fa-solid fa-list-ul"></i>
            </button>
            <button class="note-action-btn" title="导出 Markdown" @click="onExport">
              <i class="fa-solid fa-download"></i>
            </button>
            <button class="note-action-btn danger" title="删除当前笔记" @click="onDeleteActive">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </header>

        <div v-if="hasBanners" class="note-banners">
          <div v-if="store.saveState === 'conflict'" class="note-banner danger">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>该笔记已在其他设备更新，当前修改尚未保存。</span>
            <button class="btn-p btn-sm" @click="onOverwriteConflict">覆盖保存</button>
            <button class="btn-g btn-sm" @click="onLoadRemote">加载云端</button>
          </div>
          <div
            v-else-if="store.remoteUpdateAvailable"
            class="note-banner warn"
          >
            <i class="fa-solid fa-cloud-arrow-down"></i>
            <span>云端有更新{{ store.remoteUpdatedAt ? `（${formatTime(store.remoteUpdatedAt)}）` : '' }}</span>
            <button class="btn-g btn-sm" @click="onLoadRemote">加载最新</button>
            <button class="btn-ghost btn-sm" @click="store.remoteUpdateAvailable = false">稍后</button>
          </div>
          <div v-if="store.sizeWarning" class="note-banner warn">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>{{ store.sizeWarning }}</span>
          </div>
          <div v-if="store.saveState === 'error'" class="note-banner danger">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>{{ store.saveError || '保存失败' }}</span>
            <button class="btn-g btn-sm" @click="flushSave()">重试</button>
          </div>
        </div>

        <div ref="scrollEl" class="note-scroll" @scroll.passive="onScroll">
          <div class="note-doc">
            <input
              ref="titleEl"
              v-model="draftTitle"
              class="note-title-input"
              placeholder="未命名笔记"
              maxlength="200"
              @input="onTitleInput"
              @blur="flushSave()"
              @keydown.enter.prevent="onTitleEnter"
            />
            <div class="note-meta">
              <span>{{ wordCount }} 字</span>
              <span>{{ store.bookName(store.activeNote.notebookId) }}</span>
              <span v-if="store.activeNote.updatedAt">更新于 {{ formatRelativeTime(store.activeNote.updatedAt) }}</span>
            </div>

            <div class="dock-notes">
              <NoteEditor
                ref="editorRef"
                :key="editorKey"
                :initial-content="draftContent"
                @change="onEditorChange"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <header class="note-bar empty-bar">
          <button class="mobile-nav-btn" title="笔记列表" @click="sidebarOpen = true">
            <i class="fa-solid fa-bars"></i>
          </button>
          <span class="bar-title">笔记</span>
        </header>
        <div v-if="store.loading" class="note-empty-main">
          <i class="fa-solid fa-spinner fa-spin empty-icon"></i>
          <p>正在加载笔记…</p>
        </div>
        <div v-else class="note-empty-main">
          <div class="empty-icon-wrap"><i class="fa-solid fa-book-open"></i></div>
          <h2>开始记录</h2>
          <p>从左侧选择一篇笔记，或新建一篇。</p>
          <button class="btn-p" @click="onNewNote">
            <i class="fa-solid fa-plus"></i>
            新建笔记
          </button>
        </div>
      </template>
    </section>

    <NoteOutline
      v-if="store.activeNote && outlineOpen"
      :items="outline"
      :active-index="activeHeading"
      @select="scrollToHeading"
      @close="outlineOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import NotesSidebar from '../components/notes/NotesSidebar.vue';
import NoteOutline from '../components/notes/NoteOutline.vue';
import { useNoteStore } from '@shared/stores/noteStore';
import { useCloudSyncStore } from '@shared/stores/cloudSyncStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useToastStore } from '@shared/stores/toastStore';
import { countNoteWords, extractOutline, sanitizeFilename } from '@shared/utils/noteUtils';
import { formatRelativeTime } from '@shared/utils/time';

const NoteEditor = defineAsyncComponent(() => import('../components/notes/NoteEditor.vue'));

interface NoteEditorExposed {
  getMarkdown: () => string;
  focus: () => void;
}

const store = useNoteStore();
const cloudStore = useCloudSyncStore();
const dialog = useDialogStore();
const toast = useToastStore();

const titleEl = ref<HTMLInputElement | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
const editorRef = ref<NoteEditorExposed | null>(null);
const draftTitle = ref('');
const draftContent = ref('');
const editorEpoch = ref(0);
const activeHeading = ref(0);
const sidebarOpen = ref(false);
const outlineOpen = ref(readOutlineOpen());

let saveTimer: number | undefined;
let savePromise: Promise<boolean> | null = null;
let scrollRaf = 0;

const OUTLINE_OPEN_KEY = 'dock.notes.outlineOpen';

function readOutlineOpen(): boolean {
  try {
    return localStorage.getItem(OUTLINE_OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

function toggleOutline(): void {
  outlineOpen.value = !outlineOpen.value;
  try {
    localStorage.setItem(OUTLINE_OPEN_KEY, outlineOpen.value ? '1' : '0');
  } catch {
    // 忽略存储失败，仅本次会话生效
  }
}

const editorKey = computed(() => `${store.activeId ?? 'none'}:${editorEpoch.value}`);
const displayTitle = computed(() => draftTitle.value.trim() || '未命名笔记');
const outline = computed(() => extractOutline(draftContent.value));
const wordCount = computed(() => countNoteWords(draftContent.value));
const hasBanners = computed(() =>
  store.saveState === 'conflict' ||
  store.remoteUpdateAvailable ||
  !!store.sizeWarning ||
  store.saveState === 'error',
);

const saveStateText = computed(() => {
  switch (store.saveState) {
    case 'saving': return '保存中…';
    case 'conflict': return '云端冲突';
    case 'error': return '保存失败';
    case 'saved': return store.lastSavedAt ? `已保存 ${formatTime(store.lastSavedAt)}` : '已保存';
    default: return store.dirty ? '未保存' : '已保存';
  }
});

const saveStateClass = computed(() => ({
  'is-saving': store.saveState === 'saving',
  'is-saved': store.saveState === 'saved',
  'is-error': store.saveState === 'error',
  'is-conflict': store.saveState === 'conflict',
  'is-dirty': store.dirty,
}));

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resetDraftFromStore(focusEmptyTitle = false): void {
  const note = store.activeNote;
  if (!note) {
    draftTitle.value = '';
    draftContent.value = '';
    editorEpoch.value++;
    return;
  }
  draftTitle.value = note.title;
  draftContent.value = note.content;
  editorEpoch.value++;
  activeHeading.value = 0;
  void nextTick(() => {
    scrollEl.value?.scrollTo({ top: 0 });
    if (focusEmptyTitle && !note.content) titleEl.value?.focus();
  });
}

function onTitleEnter(): void {
  titleEl.value?.blur();
}

function onTitleInput(): void {
  store.touch();
  scheduleSave();
}

function onEditorChange(markdown: string): void {
  if (markdown === draftContent.value) return;
  draftContent.value = markdown;
  store.touch();
  scheduleSave();
}

function scheduleSave(): void {
  if (store.saveState === 'conflict') return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    void flushSave();
  }, 700);
}

async function flushSave(force = false): Promise<boolean> {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (savePromise) {
    const previous = await savePromise;
    if (!previous && !force) return false;
  }

  const note = store.activeNote;
  if (!note) return true;

  const latest = editorRef.value?.getMarkdown?.();
  const content = typeof latest === 'string' ? latest : draftContent.value;
  if (content !== draftContent.value) draftContent.value = content;

  if (draftTitle.value === note.title && content === note.content && !(force && store.saveState === 'conflict')) return true;
  if (store.saveState === 'conflict' && !force) return false;

  const promise = store.saveActive({ title: draftTitle.value, content }, force);
  savePromise = promise;
  try {
    const ok = await promise;
    if (ok) draftTitle.value = store.activeNote?.title ?? draftTitle.value;
    return ok;
  } finally {
    if (savePromise === promise) savePromise = null;
  }
}

async function onOverwriteConflict(): Promise<void> {
  if (!(await flushSave(true))) return;
  toast.success('已用当前内容覆盖云端版本');
}

async function onLoadRemote(): Promise<void> {
  const ok = await dialog.confirm(
    '加载云端版本',
    '当前未保存的修改会丢失，确定加载最新内容？',
  );
  if (!ok) return;
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (savePromise) await savePromise.catch(() => {});
  const loaded = await store.reloadActive();
  if (!loaded) {
    toast.error('该笔记已不存在');
    return;
  }
  resetDraftFromStore();
  toast.success('已加载云端版本');
}

async function onNewNote(): Promise<void> {
  if (!(await flushSave())) return;
  try {
    await store.createNote(store.activeNote?.notebookId);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

async function onDeleteActive(): Promise<void> {
  const note = store.activeNote;
  if (!note) return;
  const ok = await dialog.confirm(
    '删除笔记',
    `确定删除「${displayTitle.value}」？未保存的内容也会丢失。`,
  );
  if (!ok) return;
  try {
    await store.deleteNote(note.id);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

function onExport(): void {
  const content = editorRef.value?.getMarkdown?.() ?? draftContent.value;
  const filename = `${sanitizeFilename(displayTitle.value)}.md`;
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success('笔记已导出');
}

const HEADING_SELECTOR = '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6';

function onScroll(): void {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const container = scrollEl.value;
    if (!container) return;
    const headings = container.querySelectorAll<HTMLElement>(HEADING_SELECTOR);
    if (!headings.length) {
      activeHeading.value = 0;
      return;
    }
    const threshold = container.getBoundingClientRect().top + 56;
    let index = 0;
    headings.forEach((heading, current) => {
      if (heading.getBoundingClientRect().top <= threshold) index = current;
    });
    activeHeading.value = Math.min(index, Math.max(outline.value.length - 1, 0));
  });
}

function scrollToHeading(index: number): void {
  const container = scrollEl.value;
  if (!container) return;
  const heading = container.querySelectorAll<HTMLElement>(HEADING_SELECTOR)[index];
  if (!heading) return;
  const top = heading.getBoundingClientRect().top
    - container.getBoundingClientRect().top
    + container.scrollTop
    - 18;
  container.scrollTo({ top, behavior: 'smooth' });
  activeHeading.value = index;
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') void flushSave();
}

function onPageHide(): void {
  void flushSave();
}

watch(
  () => store.activeId,
  (id, previous) => {
    if (id === previous) return;
    if (!id) {
      draftTitle.value = '';
      draftContent.value = '';
      editorEpoch.value++;
      return;
    }
    resetDraftFromStore(true);
  },
);

watch(
  () => cloudStore.status.lastSyncAt,
  async (at, previous) => {
    if (!at || at === previous) return;
    await store.refreshFromDb();
  },
);

onMounted(async () => {
  await store.load();
  if (store.activeNote) resetDraftFromStore(true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
});

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer);
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('pagehide', onPageHide);
  void flushSave();
});

onBeforeRouteLeave(async () => {
  const ok = await flushSave();
  if (ok) return true;
  return dialog.confirm('离开笔记', '当前笔记有未保存或冲突内容，确定离开？');
});
</script>

<style scoped>
.notes-view {
  position: relative;
  display: flex;
  gap: var(--gap-lg);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  --note-font: BlinkMacSystemFont, Helvetica, "PingFang SC", "Luxi Sans", "DejaVu Sans", "Hiragino Sans GB", arial, "Microsoft YaHei", "Noto Sans SC", sans-serif;
}
.note-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--panel);
  overflow: hidden;
}
.note-bar {
  height: 46px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px 0 18px;
  border-bottom: 1px solid var(--border);
}
.empty-bar { justify-content: flex-start; padding-left: 18px; }
.bar-title { font-size: 13px; font-weight: var(--font-semibold); color: var(--ink2); }
.mobile-nav-btn {
  display: none;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink2);
  cursor: pointer;
}
.mobile-nav-btn:hover { background: var(--panel2); }
.breadcrumb {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  color: var(--ink4);
}
.crumb-book { white-space: nowrap; }
.crumb-sep { font-size: 8px; color: var(--ink4); }
.crumb-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink2);
}
.note-actions { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
.save-state {
  margin-right: 7px;
  font-size: 10px;
  color: var(--ink4);
  white-space: nowrap;
}
.save-state.is-saving { color: var(--accent); }
.save-state.is-error, .save-state.is-conflict { color: var(--danger); }
.save-state.is-saved.is-dirty { color: var(--warning); }
.note-action-btn {
  width: 27px;
  height: 27px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink3);
  cursor: pointer;
  font-size: 11px;
}
.note-action-btn:hover { background: var(--panel2); color: var(--ink); }
.note-action-btn.active { background: var(--panel2); color: var(--accent); }
.note-action-btn.danger:hover { color: var(--danger); }
.note-banners { flex-shrink: 0; }
.note-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  padding: 5px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 11.5px;
  color: var(--ink2);
}
.note-banner i { font-size: 12px; flex-shrink: 0; }
.note-banner span { flex: 1; min-width: 0; }
.note-banner.warn { background: color-mix(in srgb, var(--warning) 7%, transparent); }
.note-banner.warn i { color: var(--warning); }
.note-banner.danger { background: color-mix(in srgb, var(--danger) 7%, transparent); }
.note-banner.danger i { color: var(--danger); }
.note-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.note-doc {
  /* 与思源一致：内容铺满编辑区，左右留出 40px 呼吸位，不贴面板边界 */
  max-width: none;
  margin: 0;
  padding: 16px 40px 90px 40px;
}
.note-title-input {
  width: 100%;
  height: 52px;
  border: none;
  outline: none;
  background: transparent;
  padding: 0 4px 0 2px;
  color: var(--ink);
  font-family: var(--note-font);
  font-size: 32px;
  font-weight: 700;
  line-height: 52px;
  letter-spacing: normal;
}
.note-title-input::placeholder { color: var(--ink4); }
.note-meta {
  display: flex;
  align-items: center;
  gap: 13px;
  margin: 4px 0 16px;
  color: var(--ink4);
  font-size: 10.5px;
}
.note-empty-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 40px;
  color: var(--ink3);
  text-align: center;
}
.note-empty-main h2 { margin: 4px 0 0; color: var(--ink); font-size: 20px; }
.note-empty-main p { margin: 0 0 8px; font-size: 12px; color: var(--ink3); }
.empty-icon-wrap {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xl);
  background: var(--panel2);
  color: var(--accent);
  font-size: 20px;
}
.empty-icon { font-size: 22px; color: var(--accent); }
.mobile-backdrop { display: none; }

@media (max-width: 1279px) {
  .note-doc { padding: 16px 28px 80px 28px; }
  /* 大纲面板在窄屏下不显示，折叠按钮同步隐藏 */
  .note-action-btn.outline-toggle { display: none; }
}
@media (max-width: 899px) {
  .notes-view { padding-left: 12px; padding-right: 12px; gap: 0; }
  .mobile-nav-btn { display: inline-flex; align-items: center; justify-content: center; }
  .notes-sidebar {
    position: absolute;
    z-index: 130;
    top: var(--gap-lg);
    bottom: calc(var(--statusbar-h) + var(--gap-lg));
    left: 12px;
    transform: translateX(-115%);
    transition: transform 0.22s ease;
    box-shadow: var(--shadow-lg);
  }
  .notes-sidebar.mobile-open { transform: translateX(0); }
  .mobile-backdrop {
    display: block;
    position: absolute;
    z-index: 120;
    inset: 0;
    background: rgba(10, 16, 30, 0.28);
    backdrop-filter: blur(1px);
  }
  .note-doc { padding: 16px 14px 80px 16px; }
  .note-title-input { font-size: 25px; height: 42px; line-height: 42px; }
  .save-state { display: none; }
}
</style>
