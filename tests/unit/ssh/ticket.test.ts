import { describe, it, expect } from 'vitest';
import { buildSshWsUrl, describeSshError } from '../../../src/shared/ssh/ticket';
import { CloudHttpError } from '../../../src/shared/sync/cloudClient';
import {
  CloudNotConfiguredError,
  CloudTokenError,
} from '../../../src/shared/sync/syncService';
import { VaultLockedError } from '../../../src/shared/sync/snapshotBuilder';

describe('buildSshWsUrl', () => {
  it('preserves the cloud path prefix and switches to wss on https', () => {
    expect(buildSshWsUrl('https://dock.example.com', 'abc123')).toBe(
      'wss://dock.example.com/api/ssh/ws?ticket=abc123',
    );
    expect(buildSshWsUrl('https://dock.example.com/dock/', 'abc 123')).toBe(
      'wss://dock.example.com/dock/api/ssh/ws?ticket=abc+123',
    );
  });

  it('uses ws for http endpoints and keeps the port', () => {
    expect(buildSshWsUrl('http://127.0.0.1:8080', 't')).toBe(
      'ws://127.0.0.1:8080/api/ssh/ws?ticket=t',
    );
  });
});

describe('describeSshError', () => {
  it('maps cloud configuration and vault errors to settings guidance', () => {
    expect(describeSshError(new CloudNotConfiguredError()).kind).toBe('settings');
    expect(describeSshError(new VaultLockedError()).kind).toBe('settings');
    expect(describeSshError(new CloudTokenError()).kind).toBe('settings');
  });

  it('maps server responses to actionable states', () => {
    expect(describeSshError(new CloudHttpError(404, 'SERVER_NOT_FOUND')).kind).toBe('sync');
    expect(describeSshError(new CloudHttpError(503, 'SSH_DISABLED')).kind).toBe('disabled');
    expect(describeSshError(new CloudHttpError(404, 'FST_ERR_NOT_FOUND')).kind).toBe('upgrade');
    expect(describeSshError(new CloudHttpError(401, 'UNAUTHORIZED')).kind).toBe('login');
  });

  it('handles WebApiError-like objects', () => {
    expect(describeSshError({ status: 401, code: 'UNAUTHORIZED' }).kind).toBe('login');
    expect(describeSshError({ status: 404, code: 'NOT_FOUND' }).kind).toBe('upgrade');
    expect(describeSshError({ status: 503, code: 'SSH_DISABLED' }).kind).toBe('disabled');
  });

  it('falls back to the error message', () => {
    expect(describeSshError(new Error('network down'))).toEqual({
      kind: 'unknown',
      message: 'network down',
    });
  });
});
