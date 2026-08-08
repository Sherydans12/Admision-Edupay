import { describe, expect, it } from "vitest";

import {
  InMemoryObjectStorage,
  NoopEmailSender,
  NoopMalwareScanner,
} from "./operational-adapters.js";

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
    ).resolves.toEqual({
      provider: "synthetic-noop",
      status: "NOT_SCANNED_SYNTHETIC",
    });
    await expect(
      new InMemoryObjectStorage().put({
        bytes: new Uint8Array([1]),
        key: "synthetic-key",
      }),
    ).resolves.toEqual({ key: "synthetic-key", provider: "synthetic-memory" });
  });
});
