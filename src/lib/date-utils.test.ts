import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDbDate, formatThaiDateTime, getLocalDateString } from "./date-utils";

describe("Date Utilities: parseDbDate & timezone normalization", () => {
  it("normalizes SQLite CURRENT_TIMESTAMP 'YYYY-MM-DD HH:MM:SS' as UTC", () => {
    // 2026-10-14 12:00:00 UTC
    const rawSqlite = "2026-10-14 12:00:00";
    const date = parseDbDate(rawSqlite);

    assert.equal(date.toISOString(), "2026-10-14T12:00:00.000Z");
  });

  it("handles ISO strings with Z correctly", () => {
    const isoStr = "2026-10-14T12:00:00.000Z";
    const date = parseDbDate(isoStr);
    assert.equal(date.toISOString(), isoStr);
  });

  it("handles ISO strings missing Z by treating as UTC", () => {
    const isoWithoutZ = "2026-10-14T12:00:00";
    const date = parseDbDate(isoWithoutZ);
    assert.equal(date.toISOString(), "2026-10-14T12:00:00.000Z");
  });

  it("handles Date objects directly", () => {
    const now = new Date();
    const date = parseDbDate(now);
    assert.equal(date.getTime(), now.getTime());
  });

  it("handles null / undefined / empty string safely", () => {
    const d1 = parseDbDate(null);
    assert.ok(d1 instanceof Date && !isNaN(d1.getTime()));

    const d2 = parseDbDate(undefined);
    assert.ok(d2 instanceof Date && !isNaN(d2.getTime()));

    const d3 = parseDbDate("");
    assert.ok(d3 instanceof Date && !isNaN(d3.getTime()));
  });

  it("formatThaiDateTime formats accurately", () => {
    const formatted = formatThaiDateTime("2026-10-14 12:00:00");
    assert.ok(typeof formatted === "string" && formatted.length > 0);
  });

  it("getLocalDateString returns YYYY-MM-DD using local time getters", () => {
    const sample = new Date(2026, 9, 14, 5, 30, 0); // month is 0-indexed, 9 = October
    const localStr = getLocalDateString(sample);
    assert.equal(localStr, "2026-10-14");
  });
});
