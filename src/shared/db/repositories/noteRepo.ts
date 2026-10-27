import { db } from '../schema';
import type { Note } from '../../types/entities';
import { generateId } from '../../utils/id';
import { toPlain } from '../../utils/plain';
import { releaseUnusedAssets } from './noteAssetRepo';
import { noteBookRepo } from './noteBookRepo';

export class NoteNotFoundError extends Error {
  constructor(id: string) {
    super(`笔记不存在：${id}`);
    this.name = 'NoteNotFoundError';
  }
}

export class NoteSaveConflictError extends Error {
  constructor(readonly current: Note) {
    super('笔记已在其他位置更新');
    this.name = 'NoteSaveConflictError';
  }
}

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}

function normalizeTitle(title: string): string {
  return title.trim().slice(0, 512);
}

export const noteRepo = {
  async all(): Promise<Note[]> {
    return db.notes.toArray();
  },

  async byId(id: string): Promise<Note | undefined> {
    return db.notes.get(id);
  },

  async byNotebook(notebookId: string): Promise<Note[]> {
    const notes = await db.notes.where('notebookId').equals(notebookId).toArray();
    return sortNotes(notes);
  },

  /** 全文搜索；首版直接扫描本地笔记，限制 100 条 */
  async search(query: string): Promise<Note[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = await db.notes.toArray();
    return all
      .filter(note =>
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 100);
  },

  async create(input: {
    notebookId: string;
    title?: string;
    content?: string;
    sortOrder?: number;
  }): Promise<string> {
    return db.transaction('rw', db.notes, async () => {
      const now = Date.now();
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined || !Number.isFinite(sortOrder)) {
        const list = await db.notes.where('notebookId').equals(input.notebookId).toArray();
        sortOrder = list.reduce((max, note) => Math.max(max, note.sortOrder), -1) + 1;
      }

      const note: Note = {
        id: generateId(),
        notebookId: input.notebookId,
        title: normalizeTitle(input.title ?? ''),
        content: input.content ?? '',
        sortOrder,
        createdAt: now,
        updatedAt: now,
      };
      await db.notes.add(toPlain(note));
      return note.id;
    });
  },

  /** 写入完整记录（导入/恢复使用） */
  async put(note: Note): Promise<void> {
    const now = Date.now();
    const record: Note = {
      id: note.id || generateId(),
      notebookId: note.notebookId,
      title: normalizeTitle(note.title ?? ''),
      content: note.content ?? '',
      sortOrder: Number.isFinite(note.sortOrder) ? note.sortOrder : 0,
      createdAt: Number.isFinite(note.createdAt) ? note.createdAt : now,
      updatedAt: Number.isFinite(note.updatedAt) ? note.updatedAt : now,
    };
    await db.notes.put(toPlain(record));
  },

  /**
   * 保存正文/标题。expectedUpdatedAt 用于发现“远端已更新”，
   * 冲突时抛 NoteSaveConflictError，由 UI 让用户选择覆盖或加载云端。
   */
  async saveContent(
    id: string,
    patch: { title?: string; content?: string },
    expectedUpdatedAt: number,
    force = false,
  ): Promise<number> {
    return db.transaction('rw', db.notes, async () => {
      const current = await db.notes.get(id);
      if (!current) throw new NoteNotFoundError(id);

      const nextTitle = patch.title === undefined ? current.title : normalizeTitle(patch.title);
      const nextContent = patch.content === undefined ? current.content : patch.content;

      if (nextTitle === current.title && nextContent === current.content) {
        return current.updatedAt;
      }
      if (!force && current.updatedAt !== expectedUpdatedAt) {
        throw new NoteSaveConflictError(current);
      }

      const updatedAt = Math.max(Date.now(), current.updatedAt + 1);
      await db.notes.update(id, toPlain({ title: nextTitle, content: nextContent, updatedAt }));
      return updatedAt;
    });
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.notes, db.deletions, db.noteAssets, async () => {
      const note = await db.notes.get(id);
      if (!note) return;
      const now = Date.now();
      await db.deletions.put({
        id: `note:${id}`,
        entityType: 'note',
        entityId: id,
        deletedAt: now,
      });
      await db.notes.delete(id);
      await releaseUnusedAssets([note.content], now);
    });
  },

  async reorder(notebookId: string, orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.notes, async () => {
      const now = Date.now();
      for (let i = 0; i < orderedIds.length; i++) {
        const note = await db.notes.get(orderedIds[i]);
        if (!note || note.notebookId !== notebookId) continue;
        await db.notes.update(note.id, {
          sortOrder: i,
          updatedAt: Math.max(now + i, note.updatedAt + 1),
        });
      }
    });
  },

  async move(id: string, targetNotebookId: string, targetIndex: number): Promise<void> {
    await db.transaction('rw', db.notes, async () => {
      const moved = await db.notes.get(id);
      if (!moved) throw new NoteNotFoundError(id);

      if (moved.notebookId === targetNotebookId) {
        const list = sortNotes(
          (await db.notes.where('notebookId').equals(targetNotebookId).toArray())
            .filter(note => note.id !== id),
        );
        const index = Math.max(0, Math.min(targetIndex, list.length));
        list.splice(index, 0, moved);
        const now = Date.now();
        for (let i = 0; i < list.length; i++) {
          await db.notes.update(list[i].id, {
            sortOrder: i,
            updatedAt: Math.max(now + i, list[i].updatedAt + 1),
          });
        }
        return;
      }

      const source = sortNotes(
        (await db.notes.where('notebookId').equals(moved.notebookId).toArray())
          .filter(note => note.id !== id),
      );
      const target = sortNotes(
        (await db.notes.where('notebookId').equals(targetNotebookId).toArray())
          .filter(note => note.id !== id),
      );
      const index = Math.max(0, Math.min(targetIndex, target.length));
      target.splice(index, 0, moved);

      const now = Date.now();
      for (let i = 0; i < source.length; i++) {
        await db.notes.update(source[i].id, {
          sortOrder: i,
          updatedAt: Math.max(now + i, source[i].updatedAt + 1),
        });
      }
      for (let i = 0; i < target.length; i++) {
        const note = target[i];
        const patch: Partial<Note> = {
          sortOrder: i,
          updatedAt: Math.max(now + source.length + i, note.updatedAt + 1),
        };
        if (note.id === id) patch.notebookId = targetNotebookId;
        await db.notes.update(note.id, toPlain(patch));
      }
    });
  },

  /** 把找不到所属笔记本的笔记改挂到默认笔记本；没有孤儿时不创建笔记本 */
  async repairOrphanNotes(): Promise<number> {
    const [books, notes] = await Promise.all([
      db.noteBooks.toArray(),
      db.notes.toArray(),
    ]);
    const bookIds = new Set(books.map(book => book.id));
    const orphanIds = new Set(
      notes
        .filter(note => !note.notebookId || !bookIds.has(note.notebookId))
        .map(note => note.id),
    );
    if (!orphanIds.size) return 0;

    const defaultBook = await noteBookRepo.ensureDefaultNotebook();
    const base = notes
      .filter(note => note.notebookId === defaultBook.id && !orphanIds.has(note.id))
      .reduce((max, note) => Math.max(max, note.sortOrder), -1) + 1;

    const orphans = notes
      .filter(note => orphanIds.has(note.id))
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

    await db.transaction('rw', db.notes, async () => {
      const now = Date.now();
      for (let i = 0; i < orphans.length; i++) {
        const note = orphans[i];
        await db.notes.update(note.id, {
          notebookId: defaultBook.id,
          sortOrder: base + i,
          updatedAt: Math.max(now + i, note.updatedAt + 1),
        });
      }
    });
    return orphans.length;
  },

  async counts(): Promise<{ notes: number; noteBooks: number }> {
    const [notes, noteBooks] = await Promise.all([
      db.notes.count(),
      db.noteBooks.count(),
    ]);
    return { notes, noteBooks };
  },

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.notes, db.deletions, async () => {
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
      await db.notes.clear();
    });
  },
};
