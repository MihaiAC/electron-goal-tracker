import { migrateToLatest, validateVersionedData } from "./dataMigration";
import type { VersionedAppData } from "../../../types/shared";

describe("migrateToLatest", () => {
  const validBar = {
    id: "1",
    title: "Test",
    current: 10,
    max: 100,
    unit: "%",
    incrementDelta: 5,
    completedColor: "#00ff00",
    remainingColor: "#cccccc",
  };

  test("migrates valid unversioned data to version 1", () => {
    const raw = { bars: [validBar] };
    const migrated = migrateToLatest(raw);
    expect(migrated.version).toBe(1);
    expect(migrated.bars).toEqual([validBar]);
    expect(typeof migrated.lastSynced).toBe("string");
  });

  test("filters out invalid bars", () => {
    const raw = { bars: [validBar, { id: "2", title: "Bad" }] };
    const migrated = migrateToLatest(raw);
    expect(migrated.bars).toEqual([validBar]);
  });

  test("returns data as-is if already versioned", () => {
    const versioned: VersionedAppData = {
      version: 1,
      lastSynced: "2024-01-01T00:00:00Z",
      bars: [],
    };
    expect(migrateToLatest(versioned)).toBe(versioned);
  });

  test("handles non-object input gracefully", () => {
    const result = migrateToLatest(null);
    expect(result.version).toBe(1);
    expect(result.bars).toEqual([]);
  });

  test("falls back if versioned data is invalid", () => {
    const badVersioned = { version: 1, lastSynced: 1234, bars: [validBar] };
    const result = migrateToLatest(badVersioned);
    expect(result.version).toBe(1);
    expect(result.bars).toEqual([]);
  });
});

describe("validateVersionedData", () => {
  const validBar = {
    id: "1",
    title: "Test",
    current: 10,
    max: 100,
    unit: "%",
    incrementDelta: 1,
    completedColor: "#00ff00",
    remainingColor: "#cccccc",
  };

  test.each([
    [
      { version: 1, lastSynced: "2024-01-01T00:00:00Z", bars: [validBar] },
      true,
    ],
    [{ version: 1, bars: [validBar] }, true],
    [{ bars: [validBar] }, false],
    [{ version: 1, lastSynced: 123, bars: [validBar] }, false],
    [{ version: 1, lastSynced: "2024-01-01", bars: "nope" }, false],
    [{ version: 1, bars: [validBar, { id: "2" }] }, false],
    [null, false],
    [42, false],
    ["yo", false],
  ])("validateVersionedData(%j) → %s", (input, expected) => {
    expect(validateVersionedData(input)).toBe(expected as boolean);
  });
});
