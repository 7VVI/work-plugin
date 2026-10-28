import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { importExportService } from '../../../src/shared/services/importExportService';
import { noteBookRepo } from '../../../src/shared/db/repositories/noteBookRepo';
import { noteRepo } from '../../../src/shared/db/repositories/noteRepo';
import { MAX_NOTE_CONTENT } from '../../../shared/protocol/index';
import { deletionId } from '../../../src/shared/db/deletionLog';
import { strFromU8, unzipSync } from 'fflate';

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

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('markdown file archive', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('imports markdown files into notes using the file name as title', async () => {
    const bookId = await noteBookRepo.create('工作');

    const result = await importExportService.importNoteFiles([
      { name: '部署指南.md', text: '# 部署\n\n正文' },
      { name: '空文件.md', text: '   ' },
      { name: '超限.md', text: 'x'.repeat(MAX_NOTE_CONTENT + 1) },
    ], bookId);

    expect(result.created).toBe(1);
    expect(result.skipped.map(item => item.name)).toEqual(['空文件.md', '超限.md']);

    const notes = await noteRepo.all();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ notebookId: bookId, title: '部署指南', content: '# 部署\n\n正文' });
  });

  it('falls back to the first heading when the file name has no stem', async () => {
    const result = await importExportService.importNoteFiles([{ name: '.md', text: '# 只有标题\n内容' }]);
    const book = await noteBookRepo.byId(result.notebookId);
    expect(book?.name).toBe('导入笔记');
    const notes = await noteRepo.all();
    expect(notes[0].title).toBe('只有标题');
  });

  it('exports every note into a zip grouped by notebook', async () => {
    const workId = await noteBookRepo.create('工作');
    const lifeId = await noteBookRepo.create('生活');
    await noteRepo.create({ notebookId: workId, title: '部署/指南', content: '# A' });
    await noteRepo.create({ notebookId: workId, title: '部署/指南', content: '# B' });
    await noteRepo.create({ notebookId: lifeId, title: '清单', content: '# C' });

    const { blob, count } = await importExportService.exportNotesZip();
    expect(count).toBe(3);
    expect(blob.type).toBe('application/zip');

    const files = unzipSync(await readBytes(blob));
    const names = Object.keys(files).sort();
    expect(names).toEqual(['工作/部署 指南 (2).md', '工作/部署 指南.md', '生活/清单.md']);
    const text = strFromU8(files['生活/清单.md']);
    expect(text).toBe('# C');
  });
});
