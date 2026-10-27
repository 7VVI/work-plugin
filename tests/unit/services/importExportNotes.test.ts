import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { importExportService } from '../../../src/shared/services/importExportService';
import { noteBookRepo } from '../../../src/shared/db/repositories/noteBookRepo';
import { noteRepo } from '../../../src/shared/db/repositories/noteRepo';
import { MAX_NOTE_CONTENT } from '../../../shared/protocol/index';
import { deletionId } from '../../../src/shared/db/deletionLog';

describe('note import / export', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('exports notes and notebooks in the JSON backup', async () => {
    const bookId = await noteBookRepo.create('工作');
    const noteId = await noteRepo.create({
      notebookId: bookId,
      title: '标题',
      content: '# 正文',
    });

    const backup = JSON.parse(await importExportService.exportJSON());
    expect(backup.noteBooks).toHaveLength(1);
    expect(backup.noteBooks[0]).toMatchObject({ id: bookId, name: '工作' });
    expect(backup.notes).toHaveLength(1);
    expect(backup.notes[0]).toMatchObject({ id: noteId, notebookId: bookId, title: '标题', content: '# 正文' });
  });

  it('imports notebooks and notes, resolving ids and updatable records', async () => {
    const backup = JSON.stringify({
      noteBooks: [{ id: 'book-import', name: '导入工作', sortOrder: 0, createdAt: 1, updatedAt: 1 }],
      notes: [{
        id: 'note-import',
        notebookId: 'book-import',
        title: '导入笔记',
        content: '**正文**',
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      }],
    });

    const first = await importExportService.importJSON(backup, { mode: 'merge' });
    expect(first.created.noteBooks).toBe(1);
    expect(first.created.notes).toBe(1);
    expect((await noteBookRepo.byId('book-import'))?.name).toBe('导入工作');
    expect((await noteRepo.byId('note-import'))?.content).toBe('**正文**');

    const second = await importExportService.importJSON(backup, { mode: 'merge' });
    expect(second.updated.noteBooks).toBe(1);
    expect(second.updated.notes).toBe(1);
    expect(await db.notes.count()).toBe(1);
    expect(await db.noteBooks.count()).toBe(1);
  });

  it('falls back to an import notebook when the parent notebook is missing', async () => {
    const backup = JSON.stringify({
      notes: [{
        id: 'orphan-note',
        notebookId: 'missing-book',
        title: '孤儿导入',
        content: '正文',
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      }],
    });

    const summary = await importExportService.importJSON(backup, { mode: 'merge' });
    expect(summary.created.notes).toBe(1);
    const note = await noteRepo.byId('orphan-note');
    expect(note).toBeTruthy();
    expect((await noteBookRepo.byId(note!.notebookId))?.name).toBe('导入笔记');
  });

  it('skips oversized note content and records a reason', async () => {
    const backup = JSON.stringify({
      noteBooks: [{ id: 'book-large', name: '大笔记', sortOrder: 0, createdAt: 1, updatedAt: 1 }],
      notes: [{
        id: 'too-large',
        notebookId: 'book-large',
        title: '太大',
        content: 'x'.repeat(MAX_NOTE_CONTENT + 1),
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1,
      }],
    });

    const summary = await importExportService.importJSON(backup, { mode: 'merge' });
    expect(summary.created.notes).toBe(0);
    expect(summary.skipped.count).toBe(1);
    expect(await noteRepo.byId('too-large')).toBeUndefined();
  });

  it('clearAll removes notes and notebooks with tombstones', async () => {
    const bookId = await noteBookRepo.create('工作');
    const noteId = await noteRepo.create({ notebookId: bookId, title: '要清空' });

    await importExportService.clearAll();

    expect(await db.notes.count()).toBe(0);
    expect(await db.noteBooks.count()).toBe(0);
    expect(await db.deletions.get(deletionId('note', noteId))).toBeDefined();
    expect(await db.deletions.get(deletionId('noteBook', bookId))).toBeDefined();
  });
});
