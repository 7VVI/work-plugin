import { db } from '../schema';
import type { NoteBook } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';

export class LastNotebookError extends Error {
  constructor() {
    super('至少保留一个笔记本');
    this.name = 'LastNotebookError';
  }
}

function sortBooks(books: NoteBook[]): NoteBook[] {
  return [...books].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}

function normalizeName(name: string): string {
  const trimmed = name.trim().slice(0, 128);
  return trimmed || '默认笔记本';
}

export const noteBookRepo = {
  async all(): Promise<NoteBook[]> {
    return sortBooks(await db.noteBooks.toArray());
  },

  async byId(id: string): Promise<NoteBook | undefined> {
    return db.noteBooks.get(id);
  },

  async create(name: string): Promise<string> {
    return db.transaction('rw', db.noteBooks, async () => {
      const all = await db.noteBooks.toArray();
      const now = Date.now();
      const id = generateId();
      const sortOrder = all.reduce((max, book) => Math.max(max, book.sortOrder), -1) + 1;
      const book: NoteBook = {
        id,
        name: normalizeName(name),
        sortOrder,
        createdAt: now,
        updatedAt: now,
      };
      await db.noteBooks.add(toPlain(book));
      return id;
    });
  },

  /** 按主键写入（用于导入/恢复） */
  async put(book: NoteBook): Promise<void> {
    const now = Date.now();
    const record: NoteBook = {
      id: book.id || generateId(),
      name: normalizeName(book.name),
      sortOrder: Number.isFinite(book.sortOrder) ? book.sortOrder : 0,
      createdAt: Number.isFinite(book.createdAt) ? book.createdAt : now,
      updatedAt: Number.isFinite(book.updatedAt) ? book.updatedAt : now,
    };
    await db.noteBooks.put(toPlain(record));
  },

  async rename(id: string, name: string): Promise<void> {
    await db.noteBooks.update(id, toPlain({ name: normalizeName(name), updatedAt: Date.now() }));
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.noteBooks, db.notes, db.deletions, async () => {
      const book = await db.noteBooks.get(id);
      if (!book) return;
      if (await db.noteBooks.count() <= 1) throw new LastNotebookError();

      const now = Date.now();
      const notes = await db.notes.where('notebookId').equals(id).toArray();
      for (const note of notes) {
        await db.deletions.put({
          id: `note:${note.id}`,
          entityType: 'note',
          entityId: note.id,
          deletedAt: now,
        });
      }
      await db.notes.where('notebookId').equals(id).delete();
      await db.deletions.put({
        id: `noteBook:${id}`,
        entityType: 'noteBook',
        entityId: id,
        deletedAt: now,
      });
      await db.noteBooks.delete(id);
    });
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.noteBooks, async () => {
      const now = Date.now();
      for (let i = 0; i < orderedIds.length; i++) {
        const book = await db.noteBooks.get(orderedIds[i]);
        if (!book) continue;
        await db.noteBooks.update(book.id, {
          sortOrder: i,
          updatedAt: Math.max(now + i, book.updatedAt + 1),
        });
      }
    });
  },

  /** 没有笔记本时创建一个默认笔记本；已有笔记本时返回第一个，不额外创建 */
  async ensureDefaultNotebook(name = '默认笔记本'): Promise<NoteBook> {
    return db.transaction('rw', db.noteBooks, async () => {
      const all = sortBooks(await db.noteBooks.toArray());
      if (all.length) return all[0];

      const now = Date.now();
      const book: NoteBook = {
        id: generateId(),
        name: normalizeName(name),
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };
      await db.noteBooks.add(toPlain(book));
      return book;
    });
  },

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.noteBooks, db.notes, db.deletions, async () => {
      const now = Date.now();
      const notes = await db.notes.toArray();
      for (const note of notes) {
        await db.deletions.put({
          id: `note:${note.id}`,
          entityType: 'note',
          entityId: note.id,
          deletedAt: now,
        });
      }
      const books = await db.noteBooks.toArray();
      for (const book of books) {
        await db.deletions.put({
          id: `noteBook:${book.id}`,
          entityType: 'noteBook',
          entityId: book.id,
          deletedAt: now,
        });
      }
      await db.notes.clear();
      await db.noteBooks.clear();
    });
  },
};
