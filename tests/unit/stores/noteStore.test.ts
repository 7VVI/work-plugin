import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { db } from '../../../src/shared/db/schema';
import { useNoteStore } from '../../../src/shared/stores/noteStore';
import { noteRepo } from '../../../src/shared/db/repositories/noteRepo';
import { noteBookRepo } from '../../../src/shared/db/repositories/noteBookRepo';

describe('noteStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.delete();
    await db.open();
    globalThis.localStorage?.clear();
  });

  it('creates a default notebook and selects a new note', async () => {
    const store = useNoteStore();
    await store.load();
    expect(store.notes).toHaveLength(0);

    const id = await store.createNote();
    expect(id).toBeTruthy();
    expect(store.noteBooks).toHaveLength(1);
    expect(store.noteBooks[0].name).toBe('默认笔记本');
    expect(store.notes).toHaveLength(1);
    expect(store.activeId).toBe(id);
    expect(store.activeNote?.id).toBe(id);
  });

  it('saves the active note and updates its summary', async () => {
    const store = useNoteStore();
    await store.load();
    const id = (await store.createNote())!;

    store.touch();
    const ok = await store.saveActive({ title: '标题', content: '# 正文' });
    expect(ok).toBe(true);
    expect(store.saveState).toBe('saved');

    const saved = await noteRepo.byId(id);
    expect(saved?.title).toBe('标题');
    expect(saved?.content).toBe('# 正文');
    expect(store.notes[0]).toMatchObject({ id, title: '标题' });
  });

  it('detects a remote update and supports forced overwrite', async () => {
    const store = useNoteStore();
    await store.load();
    const id = (await store.createNote())!;
    const base = store.baseUpdatedAt!;

    await noteRepo.saveContent(id, { content: 'remote' }, base);
    store.touch();
    const conflicted = await store.saveActive({ title: '', content: 'local' });
    expect(conflicted).toBe(false);
    expect(store.saveState).toBe('conflict');
    expect(store.conflict?.content).toBe('remote');

    const forced = await store.saveActive({ title: '', content: 'local' }, true);
    expect(forced).toBe(true);
    expect(store.saveState).toBe('saved');
    expect((await noteRepo.byId(id))?.content).toBe('local');
  });

  it('flags remote changes without replacing the editor draft, then reloads on demand', async () => {
    const store = useNoteStore();
    await store.load();
    const id = (await store.createNote())!;
    await store.saveActive({ title: '', content: 'before' });
    const base = store.baseUpdatedAt!;

    await noteRepo.saveContent(id, { content: 'remote latest' }, base);
    await store.refreshFromDb();

    expect(store.remoteUpdateAvailable).toBe(true);
    expect(store.activeNote?.content).not.toBe('remote latest');

    await store.reloadActive();
    expect(store.remoteUpdateAvailable).toBe(false);
    expect(store.activeNote?.content).toBe('remote latest');
  });

  it('repairs orphan notes when loading the notes page', async () => {
    const store = useNoteStore();
    await store.load();
    const book = await noteBookRepo.ensureDefaultNotebook();
    const orphan = await noteRepo.create({ notebookId: 'missing', title: '孤儿' });

    await store.load();
    expect((await noteRepo.byId(orphan))?.notebookId).toBe(book.id);
    expect(store.notes.some(note => note.id === orphan)).toBe(true);
    expect(store.noteBooks.some(item => item.id === book.id)).toBe(true);
  });

  it('searches title and body and deletes the active note', async () => {
    const store = useNoteStore();
    await store.load();
    const id = (await store.createNote())!;
    await store.saveActive({ title: 'Redis 笔记', content: '主从连接信息' });

    await store.search('redis');
    expect(store.searchResults).toHaveLength(1);
    expect(store.searchResults[0].note.id).toBe(id);

    await store.search('主从');
    expect(store.searchResults).toHaveLength(1);

    await store.search('');
    expect(store.searchResults).toHaveLength(0);

    await store.deleteNote(id);
    expect(store.activeNote).toBeNull();
    expect(store.notes).toHaveLength(0);
  });
});
