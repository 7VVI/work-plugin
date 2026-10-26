import type { Db, StateRow } from './db';
import { deleteAllSessions, getMeta, setMeta } from './db';
import { authEpoch, decryptState, deriveDataKey, encryptState, keyId } from './crypto';
import {
  computeStateHash,
  emptySnapshotData,
  emptyTombstones,
  mergeServerState,
  normalizeSnapshot,
  normalizeTombstones,
  type ServerState,
  type SyncPushRequest,
  type SyncStats,
  type SyncSnapshot,
  type TombstoneMap,
} from '@protocol/index';

interface PersistedState {
  schemaVersion: 1;
  revision: number;
  snapshot: SyncSnapshot;
  tombstones: TombstoneMap;
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
  private state: ServerState = {
    revision: 0,
    snapshot: { schemaVersion: 1, generatedAt: 0, data: emptySnapshotData() },
    tombstones: emptyTombstones(),
  };
  private stateHash = '';
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: Db,
    options: { dataKey: string; dataKeyOld?: string; adminSecret: string },
  ) {
    this.key = deriveDataKey(options.dataKey);
    this.oldKey = options.dataKeyOld ? deriveDataKey(options.dataKeyOld) : undefined;
    this.epoch = authEpoch(this.key, options.adminSecret);
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

    if (usedOldKey || row.key_id !== keyId(this.key)) {
      this.persist();
    }
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

  commit(request: SyncPushRequest): Promise<CommitResult> {
    return this.runExclusive(async () => {
      const reset = request.baseRevision > this.state.revision;
      const merged = mergeServerState(this.state, request, Date.now());
      const hash = await computeStateHash(merged.state.snapshot.data, merged.state.tombstones);

      if (hash !== this.stateHash) {
        this.state = {
          revision: this.state.revision + 1,
          snapshot: {
            ...merged.state.snapshot,
            schemaVersion: 1,
            generatedAt: Date.now(),
          },
          tombstones: merged.state.tombstones,
        };
        this.stateHash = hash;
        this.persist();
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

  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}
