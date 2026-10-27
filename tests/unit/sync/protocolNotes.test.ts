import { describe, it, expect } from 'vitest';
import {
  SNAPSHOT_TABLES,
  deletionTypeForTable,
  emptySnapshotData,
  emptyTombstones,
  indexFromSnapshot,
  mergeServerState,
  normalizeData,
  normalizeSnapshot,
  normalizeTombstones,
  tableKeyForDeletionType,
  type NoteBookRec,
  type NoteRec,
  type ServerState,
  type SyncSnapshot,
} from '../../../shared/protocol/index';

function book(id: string, updatedAt = 1): NoteBookRec {
  return { id, name: id, sortOrder: 0, createdAt: updatedAt, updatedAt };
}

function note(id: string, notebookId: string, updatedAt = 2): NoteRec {
  return {
    id,
    notebookId,
    title: id,
    content: `# ${id}`,
    sortOrder: 0,
    createdAt: updatedAt,
    updatedAt,
  };
}

function snapshot(data: Partial<SyncSnapshot['data']> = {}): SyncSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: 1,
    data: { ...emptySnapshotData(), ...data },
  };
}

describe('note protocol', () => {
  it('registers note tables and deletion mappings', () => {
    expect(SNAPSHOT_TABLES).toContain('noteBooks');
    expect(SNAPSHOT_TABLES).toContain('notes');
    expect(tableKeyForDeletionType('noteBook')).toBe('noteBooks');
    expect(tableKeyForDeletionType('note')).toBe('notes');
    expect(deletionTypeForTable('noteBooks')).toBe('noteBook');
    expect(deletionTypeForTable('notes')).toBe('note');
  });

  it('fills missing note tables when reading old snapshots', () => {
    const old = {
      schemaVersion: 1,
      generatedAt: 1,
      data: {
        groups: [], tags: [], systems: [], accounts: [],
        servers: [], middlewares: [], configProjects: [], configDefs: [],
      },
    } as unknown as SyncSnapshot;

    expect(normalizeSnapshot(old).data.noteBooks).toEqual([]);
    expect(normalizeSnapshot(old).data.notes).toEqual([]);
    expect(normalizeTombstones({})).toEqual(emptyTombstones());
    expect(indexFromSnapshot(old).notes).toEqual({});
  });

  it('merges notes with LWW and tombstones', () => {
    const current: ServerState = {
      revision: 0,
      snapshot: snapshot(),
      tombstones: emptyTombstones(),
    };
    const merged = mergeServerState(current, {
      snapshot: snapshot({ noteBooks: [book('b1')], notes: [note('n1', 'b1')] }),
      tombstones: emptyTombstones(),
    }, 10);

    expect(merged.state.snapshot.data.noteBooks).toHaveLength(1);
    expect(merged.state.snapshot.data.notes).toHaveLength(1);

    const older = mergeServerState(merged.state, {
      snapshot: snapshot({ notes: [note('n1', 'b1', 1)] }),
      tombstones: emptyTombstones(),
    }, 11);
    expect(older.state.snapshot.data.notes[0].updatedAt).toBe(2);

    const tombstones = emptyTombstones();
    tombstones.notes.n1 = 20;
    const removed = mergeServerState(older.state, {
      snapshot: snapshot(),
      tombstones,
    }, 21);
    expect(removed.state.snapshot.data.notes).toHaveLength(0);

    const resurrected = mergeServerState(removed.state, {
      snapshot: snapshot({ notes: [note('n1', 'b1', 30)] }),
      tombstones: emptyTombstones(),
    }, 31);
    expect(resurrected.state.snapshot.data.notes).toHaveLength(1);
    expect(resurrected.state.tombstones.notes.n1).toBeUndefined();
  });

  it('keeps notes whose notebook is missing instead of dropping them', () => {
    const current: ServerState = {
      revision: 0,
      snapshot: snapshot(),
      tombstones: emptyTombstones(),
    };
    const merged = mergeServerState(current, {
      snapshot: snapshot({ notes: [note('n1', 'missing-book')] }),
      tombstones: emptyTombstones(),
    }, 10);

    expect(merged.state.snapshot.data.notes).toHaveLength(1);
    expect(merged.stats.droppedOrphans).toBe(0);
  });

  it('normalizes missing sortOrder and keeps titles/content strings', () => {
    const data = normalizeData({
      ...emptySnapshotData(),
      noteBooks: [{ id: 'b1', name: 'B', createdAt: 1, updatedAt: 1 } as NoteBookRec],
      notes: [{ id: 'n1', notebookId: 'b1', title: 'T', content: 'C', createdAt: 1, updatedAt: 1 } as NoteRec],
    });
    expect(data.noteBooks[0].sortOrder).toBe(0);
    expect(data.notes[0].sortOrder).toBe(0);
    expect(data.notes[0].title).toBe('T');
    expect(data.notes[0].content).toBe('C');
  });
});
