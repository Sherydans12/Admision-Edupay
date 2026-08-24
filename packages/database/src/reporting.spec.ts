import { describe, expect, it } from "vitest";

import { sanitizeAuditMetadata } from "./audit-metadata.js";
import { validateRoleAssignmentScopes } from "./access-admin.js";
import { REPORT_CATALOG, serializeCsv } from "./reporting.js";

describe("E5-H closed report catalog and CSV hardening", () => {
  it("E5H-REP-01: exposes only the seven approved P0 report definitions", () => {
    expect(REPORT_CATALOG.map((report) => report.key)).toEqual([
      "APPLICATIONS_BY_COURSE_STATUS",
      "PENDING_DOCUMENTS",
      "ACTIVITIES",
      "DECISIONS",
      "WAITLIST",
      "CAPACITY_RESERVATIONS",
      "OFFERS",
    ]);
  });

  it("E5H-REP-04: every default column belongs to its report allowlist", () => {
    for (const report of REPORT_CATALOG) {
      const allowed = new Set(
        report.allowedColumns.map((column) => column.key),
      );
      expect(report.defaultColumns.length).toBeGreaterThan(0);
      expect(report.defaultColumns.every((column) => allowed.has(column))).toBe(
        true,
      );
    }
  });

  it("E5H-REP-08: highly restricted columns are absent from the P0 catalog", () => {
    expect(
      REPORT_CATALOG.flatMap((report) => report.allowedColumns).some(
        (column) => column.sensitivity === "highly_restricted",
      ),
    ).toBe(false);
  });

  it("E5H-REP-16..17: file, deliberation, result and waitlist ranking fields are absent", () => {
    const keys = REPORT_CATALOG.flatMap((report) =>
      report.allowedColumns.map((column) => column.key),
    );
    for (const forbidden of [
      "fileBytes",
      "objectKey",
      "documentHash",
      "activityResult",
      "foundation",
      "comment",
      "waitlistPriority",
      "waitlistPosition",
      "communicationBody",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd"])(
    "E5H-REP-11..14: neutralizes formula-like text %s",
    (value) => {
      expect(serializeCsv(["value"], [{ value }])).toBe(`value\r\n'${value}`);
    },
  );

  it("E5H-REP-15: escapes quote, comma and CRLF after formula neutralization", () => {
    expect(
      serializeCsv(
        ["value", "other"],
        [{ other: "line 1\r\nline 2", value: 'texto, con "comillas"' }],
      ),
    ).toBe('value,other\r\n"texto, con ""comillas""","line 1\r\nline 2"');
  });

  it("E5H-REP-11: leading spaces do not bypass formula neutralization", () => {
    expect(serializeCsv(["value"], [{ value: "   =1+1" }])).toBe(
      "value\r\n'   =1+1",
    );
  });

  it("E5H-RBAC-01..02: scopes use only the approved controlled syntax", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(
      validateRoleAssignmentScopes([
        "*",
        `application:${id}`,
        `offering:${id}`,
        `process:${id}`,
        `campus:${id}`,
      ]),
    ).toHaveLength(5);
    expect(() => validateRoleAssignmentScopes(["free-form:tenant"])).toThrow(
      "Unknown or invalid scope",
    );
  });

  it("E5H-AUD-11..12: metadata drops secrets and sensitive bodies", () => {
    expect(
      sanitizeAuditMetadata({
        authorization: "Bearer secret",
        body: "contenido sensible",
        columns: ["applicationId"],
        cookie: "session=secret",
        password: "secret",
        reportKey: "OFFERS",
        token: "secret",
      }),
    ).toEqual({ columns: ["applicationId"], reportKey: "OFFERS" });
  });

  it("E5H-AUD-11: metadata enforces a bounded payload size", () => {
    expect(() =>
      sanitizeAuditMetadata({
        columns: Array.from(
          { length: 50 },
          (_, index) => `${index}-${"x".repeat(500)}`,
        ),
      }),
    ).toThrow("technical safety limit");
  });
});
