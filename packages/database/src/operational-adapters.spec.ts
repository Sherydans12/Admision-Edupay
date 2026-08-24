import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  InMemoryObjectStorage,
  LocalDevelopmentObjectStorage,
  NoopEmailSender,
  NoopMalwareScanner,
  SyntheticDevelopmentMalwareScanner,
  createOpaqueObjectKey,
} from "./operational-adapters.js";

const temporaryRoots: string[] = [];

async function localStorage() {
  const root = await mkdtemp(join(tmpdir(), "admission-e5c-storage-"));
  temporaryRoots.push(root);
  return new LocalDevelopmentObjectStorage({ environment: "test", root });
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    await rm(root, { force: true, recursive: true });
  }
});

describe("synthetic operational adapters", () => {
  it("never call external providers", async () => {
    await expect(
      new NoopEmailSender().send({
        body: "synthetic",
        recipient: "synthetic@example.invalid",
        subject: "synthetic",
      }),
    ).resolves.toEqual({ provider: "synthetic-noop", status: "NOOP" });
    await expect(
      new NoopMalwareScanner().scan(new Uint8Array([1, 2, 3])),
    ).resolves.toEqual({ provider: "synthetic-noop", status: "UNSCANNABLE" });
    await expect(
      new InMemoryObjectStorage().put({
        bytes: new Uint8Array([1]),
        key: "synthetic-key",
      }),
    ).resolves.toEqual({ key: "synthetic-key", provider: "synthetic-memory" });
  });

  it("E5C-STO-01: object keys are random opaque UUIDs without tenant or filename", () => {
    const first = createOpaqueObjectKey();
    const second = createOpaqueObjectKey();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toContain("tenant");
    expect(first).not.toContain("certificate");
  });

  it("E5C-STO-02: local storage rejects path traversal keys", async () => {
    const storage = await localStorage();
    await expect(storage.readQuarantine("../synthetic.pdf")).rejects.toThrow(
      "opaque UUID",
    );
  });

  it("E5C-STO-03: quarantine is not exposed through approved reads", async () => {
    const storage = await localStorage();
    const key = createOpaqueObjectKey();
    await storage.putQuarantine({ bytes: new Uint8Array([1, 2, 3]), key });
    await expect(storage.readApproved(key)).rejects.toThrow();
    await expect(storage.exists("quarantine", key)).resolves.toBe(true);
    await expect(storage.exists("approved", key)).resolves.toBe(false);
  });

  it("E5C-STO-04: the adapter has no arbitrary approved/public write primitive", async () => {
    const storage = await localStorage();
    expect("putApproved" in storage).toBe(false);
    expect("publicUrl" in storage).toBe(false);
  });

  it("E5C-STO-05: production rejects local development storage", () => {
    expect(
      () =>
        new LocalDevelopmentObjectStorage({
          environment: "production",
          root: join(tmpdir(), "admission-forbidden-production-storage"),
        }),
    ).toThrow("forbidden in production");
  });

  it("E5C-STO-06: production rejects the synthetic scanner", () => {
    expect(() => new SyntheticDevelopmentMalwareScanner("production")).toThrow(
      "forbidden in production",
    );
  });
});
