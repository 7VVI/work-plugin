import type { Db, StateRow, VersionRow } from './db';
import { deleteAllSessions, getMeta, setMeta } from './db';
import { authEpoch, decryptState, deriveDataKey, encryptState, keyId } from './crypto';
import {
  SNAPSHOT_TABLES,
  computeStateHash,
  emptySnapshotData,
  emptyTombstones,
  mergeServerState,
  normalizeSnapshot,
  normalizeTombstones,
  type ServerState,
  type SnapshotCounts,
  type SyncPushRequest,
  type SyncStats,
  type SyncSnapshot,
  type SyncVersionDetail,
  type SyncVersionMeta,
  type TombstoneMap,
  type VersionChange,
} from '@protocol/index';

interface PersistedState {
  schemaVersion: 1;
  revision: number;
  snapshot: SyncSnapshot;
  tombstones: TombstoneMap;
}

interface VersionSummaryData {
  changes: VersionChange;
  counts: SnapshotCounts;
}

function countSnapshotData(data: SyncSnapshot['data']): SnapshotCounts {
  return {
    groups: data.groups.length,
    tags: data.tags.length,
    systems: data.systems.length,
    accounts: data.accounts.length,
    servers: data.servers.length,
    middlewares: data.middlewares.length,
    configProjects: data.configProjects.length,
    configDefs: data.configDefs.length,
  };
}

function diffSnapshotData(before: SyncSnapshot['data'], after: SyncSnapshot['data']): VersionChange {
  const changes: VersionChange = { added: 0, updated: 0, deleted: 0 };
  for (const table of SNAPSHOT_TABLES) {
    const beforeTimes = new Map(before[table].map(record => [record.id, record.updatedAt]));
    const afterTimes = new Map(after[table].map(record => [record.id, record.updatedAt]));
    for (const [id, updatedAt] of afterTimes) {
      if (!beforeTimes.has(id)) changes.added++;
      else if (beforeTimes.get(id) !== updatedAt) changes.updated++;
    }
    for (const id of beforeTimes.keys()) {
      if (!afterTimes.has(id)) changes.deleted++;
    }
  }
  return changes;
}

export interface CommitResult {
  state: ServerState;
  stats: SyncStats;
  reset: boolean;
}

export class StateStore {
  private readonly key: Buffer;
  private readonly oldKey?: Buffer;
  private readonly epoch: string;
  private readonly historyLimit: number;
  private state: ServerState = {
    revision: 0,
    snapshot: { schemaVersion: 1, generatedAt: 0, data: emptySnapshotData() },
    tombstones: emptyTombstones(),
  };
  private stateHash = '';
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: Db,
    options: { dataKey: string; dataKeyOld?: string; adminSecret: string; historyLimit?: number },
  ) {
    this.key = deriveDataKey(options.dataKey);
    this.oldKey = options.dataKeyOld ? deriveDataKey(options.dataKeyOld) : undefined;
    this.epoch = authEpoch(this.key, options.adminSecret);
    this.historyLimit = Math.max(1, Math.floor(options.historyLimit ?? 100));
  }

  async init(): Promise<void> {
    const storedEpoch = getMeta(this.db, 'auth_epoch');
    if (storedEpoch !== this.epoch) {
      deleteAllSessions(this.db);
      setMeta(this.db, 'auth_epoch', this.epoch);
    }

    const row = this.db.prepare('SELECT * FROM state WHERE id = 1').get() as StateRow | undefined;
    if (!row) {
      this.state = {
        revision: 0,
        snapshot: { schemaVersion: 1, generatedAt: Date.now(), data: emptySnapshotData() },
        tombstones: emptyTombstones(),
      };
      this.stateHash = await computeStateHash(this.state.snapshot.data, this.state.tombstones);
      this.persist();
      return;
    }

    let usedOldKey = false;
    let json: string;
    const encryptedRow = { iv: row.iv, tag: row.tag, ciphertext: row.payload };
    try {
      json = decryptState(encryptedRow, this.key);
    } catch {
      if (!this.oldKey) {
        throw new Error('Cannot decrypt cloud state. Check DOCK_DATA_KEY (or set DOCK_DATA_KEY_OLD for rotation).');
      }
      json = decryptState(encryptedRow, this.oldKey);
      usedOldKey = true;
    }

    const parsed = JSON.parse(json) as PersistedState;
    this.state = {
      revision: parsed.revision ?? row.revision ?? 0,
      snapshot: normalizeSnapshot(parsed.snapshot),
      tombstones: normalizeTombstones(parsed.tombstones),
    };
    this.stateHash = await computeStateHash(this.state.snapshot.data, this.state.tombstones);

    this.migrateVersionKeys();
    if (usedOldKey || row.key_id !== keyId(this.key)) {
      this.persist();
    }
    this.backfillHistory();
  }

  getState(): ServerState {
    return this.state;
  }

  getRevision(): number {
    return this.state.revision;
  }

  getStateHash(): string {
    return this.stateHash;
  }

  listVersions(limit = 50, before?: number): SyncVersionMeta[] {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const rows = before !== undefined
      ? this.db.prepare(
        'SELECT revision, created_at, note, summary FROM versions WHERE revision < ? ORDER BY revision DESC LIMIT ?',
      ).all(before, safeLimit)
      : this.db.prepare(
        'SELECT revision, created_at, note, summary FROM versions ORDER BY revision DESC LIMIT ?',
      ).all(safeLimit);
    return (rows as Array<Pick<VersionRow, 'revision' | 'created_at' | 'note' | 'summary'>>)
      .map(row => this.versionMeta(row));
  }

  getVersion(revision: number): SyncVersionDetail | null {
    const row = this.db.prepare('SELECT * FROM versions WHERE revision = ?').get(revision) as VersionRow | undefined;
    if (!row) return null;
    const payload = JSON.parse(this.decryptVersion(row)) as {
      snapshot: SyncSnapshot;
      tombstones: TombstoneMap;
    };
    return {
      ...this.versionMeta(row),
      snapshot: normalizeSnapshot(payload.snapshot),
      tombstones: normalizeTombstones(payload.tombstones),
    };
  }

  commit(request: SyncPushRequest): Promise<CommitResult> {
    return this.runExclusive(async () => {
      const reset = request.baseRevision > this.state.revision;
      const previousSnapshot = this.state.snapshot;
      const merged = mergeServerState(this.state, request, Date.now());
      const hash = await computeStateHash(merged.state.snapshot.data, merged.state.tombstones);

      if (hash !== this.stateHash) {
        const nextState: ServerState = {
          revision: this.state.revision + 1,
          snapshot: {
            ...merged.state.snapshot,
            schemaVersion: 1,
            generatedAt: Date.now(),
          },
          tombstones: merged.state.tombstones,
        };
        const summary: VersionSummaryData = {
          changes: diffSnapshotData(previousSnapshot.data, nextState.snapshot.data),
          counts: countSnapshotData(nextState.snapshot.data),
        };
        const note = request.note?.trim() ? request.note.trim() : null;
        this.state = nextState;
        this.stateHash = hash;
        this.db.transaction(() => {
          this.persist();
          this.insertVersion(nextState, hash, note, summary, Date.now());
          this.pruneVersions();
        })();
      }

      return { state: this.state, stats: merged.stats, reset };
    });
  }

  close(): void {
    this.db.close();
  }

  private persist(): void {
    const payload: PersistedState = {
      schemaVersion: 1,
      revision: this.state.revision,
      snapshot: this.state.snapshot,
      tombstones: this.state.tombstones,
    };
    const encrypted = encryptState(JSON.stringify(payload), this.key);
    this.db.prepare(`
      INSERT INTO state (id, schema_version, revision, state_hash, updated_at, key_id, iv, tag, payload)
      VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        schema_version = excluded.schema_version,
        revision = excluded.revision,
        state_hash = excluded.state_hash,
        updated_at = excluded.updated_at,
        key_id = excluded.key_id,
        iv = excluded.iv,
        tag = excluded.tag,
        payload = excluded.payload
    `).run(
      this.state.revision,
      this.stateHash,
      Date.now(),
      encrypted.keyId,
      encrypted.iv,
      encrypted.tag,
      encrypted.ciphertext,
    );
  }

  private insertVersion(
    state: ServerState,
    hash: string,
    note: string | null,
    summary: VersionSummaryData,
    createdAt: number,
  ): void {
    const encrypted = encryptState(JSON.stringify({
      schemaVersion: 1,
      snapshot: state.snapshot,
      tombstones: state.tombstones,
    }), this.key);
    this.db.prepare(`
      INSERT INTO versions
        (revision, created_at, note, summary, state_hash, key_id, iv, tag, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      state.revision,
      createdAt,
      note,
      JSON.stringify(summary),
      hash,
      encrypted.keyId,
      encrypted.iv,
      encrypted.tag,
      encrypted.ciphertext,
    );
  }

  private pruneVersions(): void {
    this.db.prepare(`
      DELETE FROM versions WHERE revision NOT IN (
        SELECT revision FROM versions ORDER BY revision DESC LIMIT ?
      )
    `).run(this.historyLimit);
  }

  private decryptVersion(row: VersionRow): string {
    const encrypted = { iv: row.iv, tag: row.tag, ciphertext: row.payload };
    try {
      return decryptState(encrypted, this.key);
    } catch (error) {
      if (!this.oldKey) throw error;
      return decryptState(encrypted, this.oldKey);
    }
  }

  private migrateVersionKeys(): void {
    const currentKeyId = keyId(this.key);
    const rows = this.db.prepare('SELECT * FROM versions WHERE key_id != ?').all(currentKeyId) as VersionRow[];
    if (!rows.length) return;
    const update = this.db.prepare(
      'UPDATE versions SET key_id = ?, iv = ?, tag = ?, payload = ? WHERE revision = ?',
    );
    this.db.transaction(() => {
      for (const row of rows) {
        const encrypted = encryptState(this.decryptVersion(row), this.key);
        update.run(encrypted.keyId, encrypted.iv, encrypted.tag, encrypted.ciphertext, row.revision);
      }
    })();
  }

  private backfillHistory(): void {
    if (this.state.revision <= 0) return;
    const existing = this.db.prepare('SELECT 1 FROM versions WHERE revision = ?').get(this.state.revision);
    if (existing) return;
    this.insertVersion(this.state, this.stateHash, '历史起点', {
      changes: { added: 0, updated: 0, deleted: 0 },
      counts: countSnapshotData(this.state.snapshot.data),
    }, Date.now());
  }

  private versionMeta(row: Pick<VersionRow, 'revision' | 'created_at' | 'note' | 'summary'>): SyncVersionMeta {
    let summary: VersionSummaryData;
    try {
      summary = JSON.parse(row.summary) as VersionSummaryData;
    } catch {
      summary = {
        changes: { added: 0, updated: 0, deleted: 0 },
        counts: countSnapshotData(emptySnapshotData()),
      };
    }
    return {
      revision: row.revision,
      createdAt: row.created_at,
      note: row.note ?? undefined,
      changes: summary.changes,
      counts: summary.counts,
    };
  }

  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}
