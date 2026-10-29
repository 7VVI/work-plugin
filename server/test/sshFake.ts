import type {
  SshChannel,
  SshConnectOptions,
  SshConnector,
  SshTarget,
} from '../src/ssh/connector';

export class FakeSshConnector implements SshConnector {
  readonly targets: SshTarget[] = [];
  readonly options: SshConnectOptions[] = [];
  readonly writes: Buffer[] = [];
  readonly resizes: Array<{ cols: number; rows: number }> = [];
  closed = 0;
  paused = 0;
  resumed = 0;
  failWith: Error | null = null;
  delayMs = 20;

  async connect(target: SshTarget, options: SshConnectOptions): Promise<SshChannel> {
    this.targets.push(target);
    this.options.push(options);
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    if (this.failWith) throw this.failWith;
    queueMicrotask(() => options.onFingerprint('SHA256:fake-fingerprint'));
    return {
      write: (data) => { this.writes.push(Buffer.from(data)); },
      resize: (cols, rows) => { this.resizes.push({ cols, rows }); },
      pause: () => { this.paused += 1; },
      resume: () => { this.resumed += 1; },
      close: () => { this.closed += 1; },
    };
  }

  emitOutput(text: string): void {
    this.options.at(-1)?.onData(Buffer.from(text, 'utf8'));
  }

  emitExit(code = 0, signal: string | null = null): void {
    this.options.at(-1)?.onExit(code, signal);
  }
}
