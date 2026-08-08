export interface EmailSender {
  send(input: {
    body: string;
    recipient: string;
    subject: string;
  }): Promise<{ provider: "synthetic-noop"; status: "NOOP" }>;
}

export interface ObjectStorage {
  put(input: {
    bytes: Uint8Array;
    key: string;
  }): Promise<{ key: string; provider: "synthetic-memory" }>;
}

export interface MalwareScanner {
  scan(
    bytes: Uint8Array,
  ): Promise<{ provider: "synthetic-noop"; status: "NOT_SCANNED_SYNTHETIC" }>;
}

export class NoopEmailSender implements EmailSender {
  async send(_input: { body: string; recipient: string; subject: string }) {
    return { provider: "synthetic-noop" as const, status: "NOOP" as const };
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, Uint8Array>();

  async put(input: { bytes: Uint8Array; key: string }) {
    this.objects.set(input.key, new Uint8Array(input.bytes));
    return { key: input.key, provider: "synthetic-memory" as const };
  }
}

export class NoopMalwareScanner implements MalwareScanner {
  async scan(_bytes: Uint8Array) {
    return {
      provider: "synthetic-noop" as const,
      status: "NOT_SCANNED_SYNTHETIC" as const,
    };
  }
}
