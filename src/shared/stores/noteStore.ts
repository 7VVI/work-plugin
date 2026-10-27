import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { Note, NoteBook } from '../types/entities';
import { noteBookRepo } from '../db/repositories/noteBookRepo';
import { noteRepo, NoteSaveConflictError } from '../db/repositories/noteRepo';
import { buildSearchSnippet } from '../utils/noteUtils';
import { MAX_NOTE_CONTENT } from '@protocol/limits';

export interface NoteSummary {
  id: string;
  notebookId: string;
  title: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteSearchResult {
  note: NoteSummary;
  snippet: string;
}

export type NoteSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

const LAST_NOTE_KEY = 'dock.notes.last';

function toSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    notebookId: note.notebookId,
    title: note.title,
    sortOrder: note.sortOrder,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function sortSummaries(notes: NoteSummary[]): NoteSummary[] {
  return [...notes].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}

function readLastNoteId(): string | null {
  try {
    return localStorage.getItem(LAST_NOTE_KEY);
  } catch {
    return null;
  }
}

function saveLastNoteId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_NOTE_KEY, id);
    else localStorage.removeItem(LAST_NOTE_KEY);
  } catch {
    // 忽略隐私模式/存储禁用
  }
}

export const useNoteStore = defineStore('notes', () => {
  const noteBooks = ref<NoteBook[]>([]);
  const notes = ref<NoteSummary[]>([]);
  const activeNote = shallowRef<Note | null>(null);
  const activeId = ref<string | null>(null);
  const loading = ref(false);
  const searching = ref(false);
  const searchQuery = ref('');
  const searchResults = ref<NoteSearchResult[]>([]);
  const saveState = ref<NoteSaveState>('idle');
  const saveError = ref('');
  const sizeWarning = ref('');
  const lastSavedAt = ref<number | null>(null);
  const baseUpdatedAt = ref<number | null>(null);
  const dirty = ref(false);
  const conflict = ref<Note | null>(null);
  const remoteUpdateAvailable = ref(false);
  const remoteUpdatedAt = ref<number | null>(null);

  const activeBook = computed(() =>
    noteBooks.value.find(book => book.id === activeNote.value?.notebookId) ?? null,
  );
  const activeNoteTitle = computed(() => activeNote.value?.title?.trim() || '未命名笔记');
  const hasNotes = computed(() => notes.value.length > 0);
  const canDeleteNotebook = computed(() => noteBooks.value.length > 1);

  function notesForNotebook(notebookId: string): NoteSummary[] {
    return sortSummaries(notes.value.filter(note => note.notebookId === notebookId));
  }

  function bookName(id: string): string {
    return noteBooks.value.find(book => book.id === id)?.name ?? '未分类';
  }

  async function select(id: string): Promise<boolean> {
    const note = await noteRepo.byId(id);
    if (!note) {
      clearActive();
      return false;
    }
    activeNote.value = note;
    activeId.value = id;
    baseUpdatedAt.value = note.updatedAt;
    dirty.value = false;
    saveState.value = 'saved';
    lastSavedAt.value = note.updatedAt;
    saveError.value = '';
    sizeWarning.value = note.content.length > MAX_NOTE_CONTENT
      ? `正文超过单篇 ${MAX_NOTE_CONTENT} 字符限制，本地可保存但不能同步到云端`
      : '';
    conflict.value = null;
    remoteUpdateAvailable.value = false;
    remoteUpdatedAt.value = null;
    saveLastNoteId(id);
    return true;
  }

  function clearActive(): void {
    activeNote.value = null;
    activeId.value = null;
    baseUpdatedAt.value = null;
    dirty.value = false;
    saveState.value = 'idle';
    lastSavedAt.value = null;
    saveError.value = '';
    sizeWarning.value = '';
    conflict.value = null;
    remoteUpdateAvailable.value = false;
    remoteUpdatedAt.value = null;
    saveLastNoteId(null);
  }

  async function load(options: { preserveActive?: boolean } = {}): Promise<void> {
    loading.value = true;
    try {
      await noteRepo.repairOrphanNotes();
      const [books, all] = await Promise.all([
        noteBookRepo.all(),
        noteRepo.all(),
      ]);
      noteBooks.value = books;
      notes.value = all.map(toSummary);

      const currentId = activeId.value;
      if (currentId) {
        const latest = await noteRepo.byId(currentId);
        if (!latest) {
          clearActive();
        } else if (options.preserveActive) {
          if (latest.updatedAt !== baseUpdatedAt.value) {
            if (dirty.value) {
              remoteUpdateAvailable.value = true;
              remoteUpdatedAt.value = latest.updatedAt;
            } else {
              remoteUpdateAvailable.value = true;
              remoteUpdatedAt.value = latest.updatedAt;
            }
          }
        } else if (!dirty.value) {
          activeNote.value = latest;
          baseUpdatedAt.value = latest.updatedAt;
          lastSavedAt.value = latest.updatedAt;
          saveState.value = 'saved';
        }
      } else {
        const remembered = readLastNoteId();
        if (remembered && all.some(note => note.id === remembered)) {
          await select(remembered);
        }
      }
    } finally {
      loading.value = false;
    }
  }

  async function refreshFromDb(): Promise<void> {
    await load({ preserveActive: true });
  }

  function touch(): void {
    dirty.value = true;
    if (saveState.value !== 'conflict') saveState.value = 'idle';
  }

  async function saveActive(
    draft: { title: string; content: string },
    force = false,
  ): Promise<boolean> {
    const current = activeNote.value;
    if (!current) return false;
    if (!force && baseUpdatedAt.value === null) return false;

    saveState.value = 'saving';
    saveError.value = '';
    sizeWarning.value = draft.content.length > MAX_NOTE_CONTENT
      ? `正文超过单篇 ${MAX_NOTE_CONTENT} 字符限制，本地可保存但不能同步到云端`
      : '';

    try {
      const updatedAt = await noteRepo.saveContent(
        current.id,
        { title: draft.title, content: draft.content },
        baseUpdatedAt.value ?? current.updatedAt,
        force,
      );
      activeNote.value = {
        ...current,
        title: draft.title.trim().slice(0, 512),
        content: draft.content,
        updatedAt,
      };
      baseUpdatedAt.value = updatedAt;
      dirty.value = false;
      conflict.value = null;
      remoteUpdateAvailable.value = false;
      remoteUpdatedAt.value = null;
      lastSavedAt.value = Date.now();
      saveState.value = 'saved';

      const index = notes.value.findIndex(note => note.id === current.id);
      if (index >= 0) {
        notes.value[index] = {
          ...notes.value[index],
          title: draft.title.trim().slice(0, 512),
          updatedAt,
        };
      }
      return true;
    } catch (error) {
      if (error instanceof NoteSaveConflictError) {
        conflict.value = error.current;
        saveState.value = 'conflict';
        saveError.value = '该笔记已在其他设备更新';
        return false;
      }
      saveState.value = 'error';
      saveError.value = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  async function reloadActive(): Promise<boolean> {
    if (!activeId.value) return false;
    const ok = await select(activeId.value);
    if (!ok) await load();
    return ok;
  }

  async function createNotebook(name: string): Promise<string> {
    const id = await noteBookRepo.create(name);
    noteBooks.value = await noteBookRepo.all();
    return id;
  }

  async function renameNotebook(id: string, name: string): Promise<void> {
    await noteBookRepo.rename(id, name);
    noteBooks.value = await noteBookRepo.all();
  }

  async function deleteNotebook(id: string): Promise<void> {
    const activeInBook = activeNote.value?.notebookId === id;
    await noteBookRepo.remove(id);
    if (activeInBook) clearActive();
    await load();
  }

  async function createNote(notebookId?: string): Promise<string | null> {
    let target = notebookId;
    if (!target) {
      const book = await noteBookRepo.ensureDefaultNotebook();
      target = book.id;
    }
    const id = await noteRepo.create({ notebookId: target, title: '', content: '' });
    await load();
    await select(id);
    return id;
  }

  async function deleteNote(id: string): Promise<void> {
    await noteRepo.remove(id);
    if (activeId.value === id) clearActive();
    await load();
  }

  async function moveNote(id: string, notebookId: string, index: number): Promise<void> {
    await noteRepo.move(id, notebookId, index);
    await load();
  }

  async function reorderNotebooks(ids: string[]): Promise<void> {
    await noteBookRepo.reorder(ids);
    noteBooks.value = await noteBookRepo.all();
  }

  async function reorderNotes(notebookId: string, ids: string[]): Promise<void> {
    await noteRepo.reorder(notebookId, ids);
    await load();
  }

  async function search(query: string): Promise<void> {
    searchQuery.value = query;
    const q = query.trim();
    if (!q) {
      searchResults.value = [];
      searching.value = false;
      return;
    }
    searching.value = true;
    try {
      const found = await noteRepo.search(q);
      searchResults.value = found.map(note => ({
        note: toSummary(note),
        snippet: buildSearchSnippet(note.content, q),
      }));
    } finally {
      searching.value = false;
    }
  }

  return {
    noteBooks,
    notes,
    activeNote,
    activeId,
    activeBook,
    activeNoteTitle,
    hasNotes,
    canDeleteNotebook,
    loading,
    searching,
    searchQuery,
    searchResults,
    saveState,
    saveError,
    sizeWarning,
    lastSavedAt,
    baseUpdatedAt,
    dirty,
    conflict,
    remoteUpdateAvailable,
    remoteUpdatedAt,
    notesForNotebook,
    bookName,
    select,
    clearActive,
    load,
    refreshFromDb,
    touch,
    saveActive,
    reloadActive,
    createNotebook,
    renameNotebook,
    deleteNotebook,
    createNote,
    deleteNote,
    moveNote,
    reorderNotebooks,
    reorderNotes,
    search,
  };
});
