import { describe, expect, it } from "vitest";
import { isAdultStudent } from "./application-authority.js";

describe("R12 age semantics", () => {
  it("R12-AGE-01..04: uses calendar dates at the eighteenth birthday boundary", () => {
    expect(isAdultStudent("2008-08-16", "2026-08-16")).toBe(true);
    expect(isAdultStudent("2008-08-17", "2026-08-16")).toBe(false);
    expect(isAdultStudent("2008-08-17", "2026-08-16")).toBe(false);
    expect(isAdultStudent("2008-08-16", new Date("2026-08-16T23:59:59Z"))).toBe(
      true,
    );
  });

  it("R12-AGE-05: handles leap-day DOB deterministically without duration arithmetic", () => {
    expect(isAdultStudent("2008-02-29", "2026-02-28")).toBe(false);
    expect(isAdultStudent("2008-02-29", "2026-03-01")).toBe(true);
  });

  it("R12-AGE-06: rejects non-calendar date strings", () => {
    expect(() => isAdultStudent("2008-02-30", "2026-08-16")).toThrow(
      /Invalid calendar date/i,
    );
    expect(() => isAdultStudent("2008/02/29", "2026-08-16")).toThrow(
      /Invalid calendar date/i,
    );
  });
});
