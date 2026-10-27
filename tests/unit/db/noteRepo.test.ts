import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { noteBookRepo, LastNotebookError } from '../../../src/shared/db/repositories/noteBookRepo';
import { noteRepo, NoteSaveConflictError } from '../../../src/shared/db/repositories/noteRepo';
import { deletionId } from '../../../src/shared/db/deletionLog';

describe('note repositories', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates notes with sequential sortOrder and searches title/content', async () => {
    const bookId = await noteBookRepo.create('工作');
    const first = await noteRepo.create({ notebookId: bookId, title: 'Redis 笔记' });
    const second = await noteRepo.create({ notebookId: bookId, title: 'MySQL', content: '主库连接信息' });

    expect((await noteRepo.byId(first))?.sortOrder).toBe(0);
    expect((await noteRepo.byId(second))?.sortOrder).toBe(1);

    const byTitle = await noteRepo.search('redis');
    expect(byTitle.map(note => note.id)).toEqual([first]);

    const byContent = await noteRepo.search('主库');
    expect(byContent.map(note => note.id)).toEqual([second]);
  });

  it('saves content with monotonic timestamps and detects conflicts', async () => {
    const bookId = await noteBookRepo.create('工作');
    const id = await noteRepo.create({ notebookId: bookId, title: 'A' });
    const original = (await noteRepo.byId(id))!;

    const firstSave = await noteRepo.saveContent(id, { content: '第一版' }, original.updatedAt);
    expect(firstSave).toBeGreaterThan(original.updatedAt);

    const secondSave = await noteRepo.saveContent(id, { content: '第二版' }, firstSave);
    expect(secondSave).toBeGreaterThan(firstSave);

    await expect(
      noteRepo.saveContent(id, { content: '过期写入' }, firstSave),
    ).rejects.toBeInstanceOf(NoteSaveConflictError);

    await expect(
      noteRepo.saveContent(id, { content: '强制覆盖' }, firstSave, true),
    ).resolves.toBeGreaterThan(secondSave);
  });

  it('does not bump timestamps when content is unchanged', async () => {
    const bookId = await noteBookRepo.create('工作');
    const id = await noteRepo.create({ notebookId: bookId, content: 'same' });
    const current = (await noteRepo.byId(id))!;

    const saved = await noteRepo.saveContent(id, { content: 'same' }, 0);
    expect(saved).toBe(current.updatedAt);
  });

  it('cascades notebook deletion and records both tombstones', async () => {
    const first = await noteBookRepo.create('A');
    await noteBookRepo.create('B');
    const noteId = await noteRepo.create({ notebookId: first });

    await noteBookRepo.remove(first);

    expect(await noteRepo.byId(noteId)).toBeUndefined();
    expect(await db.deletions.get(deletionId('note', noteId))).toMatchObject({
      entityType: 'note',
      entityId: noteId,
    });
    expect(await db.deletions.get(deletionId('noteBook', first))).toMatchObject({
      entityType: 'noteBook',
      entityId: first,
    });
  });

  it('refuses to delete the last notebook', async () => {
    const only = await noteBookRepo.create('Only');
    await expect(noteBookRepo.remove(only)).rejects.toBeInstanceOf(LastNotebookError);
  });

  it('reorders and moves notes across notebooks', async () => {
    const firstBook = await noteBookRepo.create('A');
    const secondBook = await noteBookRepo.create('B');
    const a = await noteRepo.create({ notebookId: firstBook, title: 'A' });
    const b = await noteRepo.create({ notebookId: firstBook, title: 'B' });
    const c = await noteRepo.create({ notebookId: secondBook, title: 'C' });

    await noteRepo.reorder(firstBook, [b, a]);
    expect((await noteRepo.byId(b))?.sortOrder).toBe(0);
    expect((await noteRepo.byId(a))?.sortOrder).toBe(1);

    await noteRepo.move(a, secondBook, 0);
    expect((await noteRepo.byId(a))?.notebookId).toBe(secondBook);
    expect((await noteRepo.byId(a))?.sortOrder).toBe(0);
    expect((await noteRepo.byId(c))?.sortOrder).toBe(1);
  });

  it('repairs orphan notes by attaching them to the first existing notebook', async () => {
    const bookId = await noteBookRepo.create('A');
    const orphan = await noteRepo.create({ notebookId: 'missing', title: '孤儿' });
    await noteRepo.create({ notebookId: bookId, title: '正常' });

    expect(await noteRepo.repairOrphanNotes()).toBe(1);
    expect((await noteRepo.byId(orphan))?.notebookId).toBe(bookId);
    expect(await db.noteBooks.count()).toBe(1);
  });

  it('creates a default notebook when repairing orphans without any notebook', async () => {
    const orphan = await noteRepo.create({ notebookId: 'missing', title: '孤儿' });

    expect(await noteRepo.repairOrphanNotes()).toBe(1);
    const books = await noteBookRepo.all();
    expect(books).toHaveLength(1);
    expect(books[0].name).toBe('默认笔记本');
    expect((await noteRepo.byId(orphan))?.notebookId).toBe(books[0].id);
  });

  it('does not create a default notebook when there are no orphans', async () => {
    expect(await noteRepo.repairOrphanNotes()).toBe(0);
    expect(await db.noteBooks.count()).toBe(0);
  });

  it('clearAll records tombstones for notes and notebooks', async () => {
    const bookId = await noteBookRepo.create('A');
    const noteId = await noteRepo.create({ notebookId: bookId });

    await noteRepo.clearAll();
    await noteBookRepo.clearAll();

    expect(await db.notes.count()).toBe(0);
    expect(await db.noteBooks.count()).toBe(0);
    expect(await db.deletions.get(deletionId('note', noteId))).toBeDefined();
    expect(await db.deletions.get(deletionId('noteBook', bookId))).toBeDefined();
  });
});
