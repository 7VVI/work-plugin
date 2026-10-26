import { SNAPSHOT_TABLES, type SyncPushRequest } from '@protocol/index';
import { badRequest } from './errors';

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_RECORDS = 20_000;
const MAX_STRING = 65_536;
const MAX_DEPTH = 12;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function assertPlain(value: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) badRequest('INVALID_PAYLOAD', 'Payload too deep');
  if (value === null) return;
  if (typeof value === 'string') {
    if (value.length > MAX_STRING) badRequest('INVALID_PAYLOAD', 'String too long');
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) badRequest('INVALID_PAYLOAD', 'Invalid number');
    return;
  }
  if (typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    if (value.length > MAX_RECORDS) badRequest('INVALID_PAYLOAD', 'Array too large');
    for (const item of value) assertPlain(item, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === '__encrypted') badRequest('INVALID_PAYLOAD', 'Encrypted fields are not accepted');
      if (key.length > 200) badRequest('INVALID_PAYLOAD', 'Key too long');
      assertPlain(child, depth + 1);
    }
    return;
  }
  badRequest('INVALID_PAYLOAD', 'Unsupported value');
}

function validateId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    badRequest('INVALID_PAYLOAD', `Invalid ${label}`);
  }
  return value;
}

function validateTimestamp(value: unknown, now: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    badRequest('INVALID_PAYLOAD', 'Invalid timestamp');
  }
  return Math.min(Math.max(0, Math.floor(value)), now + FUTURE_SKEW_MS);
}

function validateTagIds(value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 500) {
    badRequest('INVALID_PAYLOAD', 'Invalid tagIds');
  }
  for (const id of value) validateId(id, 'tagId');
}

function validateRecord(table: string, record: Record<string, unknown>, now: number): void {
  validateId(record.id, `${table}.id`);
  validateTimestamp(record.updatedAt, now);
  if (record.createdAt !== undefined) validateTimestamp(record.createdAt, now);

  if (table === 'systems' || table === 'servers' || table === 'middlewares') {
    validateTagIds(record.tagIds);
  }
  if (table === 'configDefs') {
    if (!Array.isArray(record.fields) || record.fields.length > 500) {
      badRequest('INVALID_PAYLOAD', 'Invalid config fields');
    }
    for (const field of record.fields) {
      if (!field || typeof field !== 'object') badRequest('INVALID_PAYLOAD', 'Invalid config field');
      const item = field as Record<string, unknown>;
      for (const key of ['key', 'label', 'value']) {
        if (typeof item[key] !== 'string') badRequest('INVALID_PAYLOAD', 'Invalid config field value');
      }
    }
  }
}

export function validatePushRequest(body: unknown): SyncPushRequest {
  if (!body || typeof body !== 'object') badRequest('INVALID_PAYLOAD', 'Body must be an object');
  assertPlain(body);

  const payload = body as Record<string, unknown>;
  if (payload.protocol !== 1) badRequest('INVALID_PROTOCOL', 'Unsupported protocol');
  if (typeof payload.clientId !== 'string' || !ID_RE.test(payload.clientId)) {
    badRequest('INVALID_PAYLOAD', 'Invalid clientId');
  }
  if (typeof payload.baseRevision !== 'number' || !Number.isInteger(payload.baseRevision) || payload.baseRevision < 0) {
    badRequest('INVALID_PAYLOAD', 'Invalid baseRevision');
  }

  const snapshot = payload.snapshot as Record<string, unknown> | undefined;
  if (!snapshot || snapshot.schemaVersion !== 1 || !snapshot.data || typeof snapshot.data !== 'object') {
    badRequest('INVALID_PAYLOAD', 'Invalid snapshot');
  }

  const data = snapshot.data as Record<string, unknown>;
  const now = Date.now();
  for (const table of SNAPSHOT_TABLES) {
    const list = data[table];
    if (!Array.isArray(list) || list.length > MAX_RECORDS) {
      badRequest('INVALID_PAYLOAD', `Invalid ${table}`);
    }
    const ids = new Set<string>();
    for (const item of list) {
      if (!item || typeof item !== 'object') badRequest('INVALID_PAYLOAD', `Invalid ${table} record`);
      const record = item as Record<string, unknown>;
      validateRecord(table, record, now);
      const id = record.id as string;
      if (ids.has(id)) badRequest('INVALID_PAYLOAD', `Duplicate ${table} id`);
      ids.add(id);
      if (record.updatedAt !== undefined) record.updatedAt = validateTimestamp(record.updatedAt, now);
      if (record.createdAt !== undefined) record.createdAt = validateTimestamp(record.createdAt, now);
    }
  }

  const tombstones = payload.tombstones;
  if (!tombstones || typeof tombstones !== 'object') badRequest('INVALID_PAYLOAD', 'Invalid tombstones');
  for (const table of SNAPSHOT_TABLES) {
    const list = (tombstones as Record<string, unknown>)[table];
    if (!list || typeof list !== 'object' || Array.isArray(list)) {
      badRequest('INVALID_PAYLOAD', `Invalid tombstones.${table}`);
    }
    const entries = Object.entries(list as Record<string, unknown>);
    if (entries.length > MAX_RECORDS) badRequest('INVALID_PAYLOAD', 'Too many tombstones');
    for (const [id, deletedAt] of entries) {
      validateId(id, 'tombstone id');
      if (typeof deletedAt !== 'number' || !Number.isFinite(deletedAt)) {
        badRequest('INVALID_PAYLOAD', 'Invalid tombstone timestamp');
      }
      (list as Record<string, number>)[id] = Math.min(
        Math.max(0, Math.floor(deletedAt)),
        now + FUTURE_SKEW_MS,
      );
    }
  }

  return body as SyncPushRequest;
}

export function validateLoginBody(body: unknown): string {
  if (!body || typeof body !== 'object') badRequest('INVALID_PAYLOAD', 'Body must be an object');
  const secret = (body as Record<string, unknown>).secret;
  if (typeof secret !== 'string' || secret.length < 1 || secret.length > 1024) {
    badRequest('INVALID_PAYLOAD', 'Invalid secret');
  }
  return secret;
}

export function validateSessionDays(body: unknown): number {
  if (!body || typeof body !== 'object') badRequest('INVALID_PAYLOAD', 'Body must be an object');
  const value = (body as Record<string, unknown>).sessionDays;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    badRequest('INVALID_PAYLOAD', 'Invalid sessionDays');
  }
  return Math.min(3650, Math.max(1, Math.floor(value)));
}
