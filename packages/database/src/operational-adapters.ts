import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

export interface EmailSender {
  send(input: {
    body: string;
    recipient: string;
    subject: string;
  }): Promise<{ provider: "synthetic-noop"; status: "NOOP" }>;
}

export type ObjectStorageArea = "approved" | "quarantine";

export interface ObjectStorage {
  deleteQuarantine(key: string): Promise<void>;
  exists(area: ObjectStorageArea, key: string): Promise<boolean>;
  promote(input: {
    approvedKey: string;
    quarantineKey: string;
  }): Promise<{ key: string; provider: string }>;
  putQuarantine(input: {
    bytes: Uint8Array;
    key: string;
  }): Promise<{ key: string; provider: string }>;
  readApproved(key: string): Promise<Uint8Array>;
  readQuarantine(key: string): Promise<Uint8Array>;
}

export type MalwareScanStatus = "CLEAN" | "ERROR" | "INFECTED" | "UNSCANNABLE";

export interface MalwareScanResult {
  engineVersion?: string;
  provider: string;
  signatureVersion?: string;
  status: MalwareScanStatus;
}

export interface MalwareScanner {
  scan(bytes: Uint8Array): Promise<MalwareScanResult>;
}

export function createOpaqueObjectKey(): string {
  return randomUUID();
}

export class NoopEmailSender implements EmailSender {
  async send(_input: { body: string; recipient: string; subject: string }) {
    return { provider: "synthetic-noop" as const, status: "NOOP" as const };
  }
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function storageMapKey(area: ObjectStorageArea, key: string): string {
  assertOpaqueObjectKey(key);
  return `${area}:${key}`;
}

export function assertOpaqueObjectKey(key: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key,
    )
  ) {
    throw new TypeError("Object key must be an opaque UUID");
  }
}

export class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, Uint8Array>();

  /** E4 compatibility helper. New document flows use putQuarantine. */
  async put(input: { bytes: Uint8Array; key: string }) {
    this.objects.set(`legacy:${input.key}`, copyBytes(input.bytes));
    return { key: input.key, provider: "synthetic-memory" as const };
  }

  async putQuarantine(input: { bytes: Uint8Array; key: string }) {
    this.objects.set(
      storageMapKey("quarantine", input.key),
      copyBytes(input.bytes),
    );
    return { key: input.key, provider: "synthetic-memory" };
  }

  async readQuarantine(key: string) {
    return this.read("quarantine", key);
  }

  async readApproved(key: string) {
    return this.read("approved", key);
  }

  async promote(input: { approvedKey: string; quarantineKey: string }) {
    const bytes = await this.readQuarantine(input.quarantineKey);
    const approvedMapKey = storageMapKey("approved", input.approvedKey);
    if (!this.objects.has(approvedMapKey)) {
      this.objects.set(approvedMapKey, copyBytes(bytes));
    }
    return { key: input.approvedKey, provider: "synthetic-memory" };
  }

  async deleteQuarantine(key: string): Promise<void> {
    this.objects.delete(storageMapKey("quarantine", key));
  }

  async exists(area: ObjectStorageArea, key: string): Promise<boolean> {
    return this.objects.has(storageMapKey(area, key));
  }

  private async read(
    area: ObjectStorageArea,
    key: string,
  ): Promise<Uint8Array> {
    const bytes = this.objects.get(storageMapKey(area, key));
    if (bytes === undefined) throw new Error("OBJECT_NOT_FOUND");
    return copyBytes(bytes);
  }
}

export class LocalDevelopmentObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(input: { environment: string; root: string }) {
    if (input.environment === "production") {
      throw new Error(
        "LocalDevelopmentObjectStorage is forbidden in production",
      );
    }
    if (!isAbsolute(input.root)) {
      throw new TypeError("Local development storage root must be absolute");
    }
    this.root = resolve(input.root);
  }

  async putQuarantine(input: { bytes: Uint8Array; key: string }) {
    const path = this.objectPath("quarantine", input.key);
    await mkdir(resolve(this.root, "quarantine"), { recursive: true });
    await writeFile(path, input.bytes, { flag: "wx" });
    return { key: input.key, provider: "local-development" };
  }

  async readQuarantine(key: string) {
    return new Uint8Array(await readFile(this.objectPath("quarantine", key)));
  }

  async readApproved(key: string) {
    return new Uint8Array(await readFile(this.objectPath("approved", key)));
  }

  async promote(input: { approvedKey: string; quarantineKey: string }) {
    const approved = this.objectPath("approved", input.approvedKey);
    if (!(await this.exists("approved", input.approvedKey))) {
      const bytes = await this.readQuarantine(input.quarantineKey);
      await mkdir(resolve(this.root, "approved"), { recursive: true });
      await writeFile(approved, bytes, { flag: "wx" });
    }
    return { key: input.approvedKey, provider: "local-development" };
  }

  async deleteQuarantine(key: string): Promise<void> {
    await rm(this.objectPath("quarantine", key), { force: true });
  }

  async exists(area: ObjectStorageArea, key: string): Promise<boolean> {
    try {
      const result = await stat(this.objectPath(area, key));
      return result.isFile();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  private objectPath(area: ObjectStorageArea, key: string): string {
    assertOpaqueObjectKey(key);
    const areaRoot = resolve(this.root, area);
    const result = resolve(join(areaRoot, key));
    if (!result.startsWith(`${areaRoot}${sep}`)) {
      throw new TypeError("Object key escapes storage root");
    }
    return result;
  }
}

/**
 * Deliberately non-protective adapter retained for E4 compatibility. Its
 * UNSCANNABLE result is fail-closed and can never promote a document.
 */
export class NoopMalwareScanner implements MalwareScanner {
  async scan(_bytes: Uint8Array): Promise<MalwareScanResult> {
    return { provider: "synthetic-noop", status: "UNSCANNABLE" };
  }
}

const SYNTHETIC_CONTROLS: ReadonlyArray<
  readonly [marker: string, status: MalwareScanStatus]
> = [
  ["SYNTHETIC_MALWARE_TEST_CONTROL", "INFECTED"],
  ["SYNTHETIC_SCAN_ERROR_CONTROL", "ERROR"],
  ["SYNTHETIC_UNSCANNABLE_CONTROL", "UNSCANNABLE"],
];

/** Pipeline test double only. It is not an antivirus product. */
export class SyntheticDevelopmentMalwareScanner implements MalwareScanner {
  constructor(environment: string) {
    if (environment === "production") {
      throw new Error(
        "SyntheticDevelopmentMalwareScanner is forbidden in production",
      );
    }
  }

  async scan(bytes: Uint8Array): Promise<MalwareScanResult> {
    const text = new TextDecoder("latin1").decode(bytes);
    const status =
      SYNTHETIC_CONTROLS.find(([marker]) => text.includes(marker))?.[1] ??
      "CLEAN";
    return {
      engineVersion: "synthetic-development-1",
      provider: "synthetic-development",
      signatureVersion: "synthetic-controls-v1",
      status,
    };
  }
}
