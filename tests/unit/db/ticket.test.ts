import { describe, it, expect } from 'vitest';
import { buildDbWsUrl } from '../../../src/shared/db/ticket';

describe('buildDbWsUrl', () => {
  it('uses wss for https endpoints', () => {
    const url = buildDbWsUrl('https://cloud.example.com', 'tk');
    expect(url).toBe('wss://cloud.example.com/api/db/ws?ticket=tk');
  });

  it('uses ws for http endpoints and keeps a path prefix', () => {
    const url = buildDbWsUrl('http://127.0.0.1:8080/dock/', 'tk');
    expect(url).toBe('ws://127.0.0.1:8080/dock/api/db/ws?ticket=tk');
  });

  it('drops the hash fragment', () => {
    const url = buildDbWsUrl('https://cloud.example.com/app#x', 'tk');
    expect(url).not.toContain('#');
  });
});
