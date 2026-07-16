import 'fake-indexeddb/auto';
import './mocks/chrome';

// Stub BroadcastChannel to avoid Node.js Event type validation errors.
// Dexie uses BroadcastChannel for cross-tab sync, which isn't needed in tests.
// Node's BroadcastChannel.dispatchEvent rejects MessageEvent instances
// (ERR_INVALID_ARG_TYPE), causing unhandled errors that fail the test run.
class StubBroadcastChannel {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onmessageerror: ((ev: MessageEvent) => void) | null = null;
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  postMessage(): void {
    // no-op: cross-tab sync not needed in tests
  }
  close(): void {
    // no-op
  }
  addEventListener(): void {
    // no-op
  }
  removeEventListener(): void {
    // no-op
  }
  dispatchEvent(): boolean {
    return true;
  }
}

(globalThis as unknown as { BroadcastChannel: typeof StubBroadcastChannel }).BroadcastChannel =
  StubBroadcastChannel;
