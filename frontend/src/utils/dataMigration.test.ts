import { migrateToLatest } from "./dataMigration";
import type { VersionedAppData } from "../../../types/shared";

describe("migrateToLatest", () => {
  test("migrates valid unversioned data to version 1", () => {
    const raw = {
      bars: [
        {
          id: "1",
          title: "Test",
          current: 10,
          max: 100,
          unit: "%",
          incrementDelta: 5,
          completedColor: "#00ff00",
          remainingColor: "#cccccc",
        },
      ],
    };

    const migrated = migrateToLatest(raw);
    expect(migrated.version).toBe(1);
    expect(Array.isArray(migrated.bars)).toBe(true);
    expect(migrated.bars.length).toBe(1);
    expect(typeof migrated.lastSynced).toBe("string");
  });

  test("filters out invalid bars", () => {
    const raw = {
      bars: [
        {
          id: "1",
          title: "Valid",
          current: 10,
          max: 100,
          unit: "%",
          incrementDelta: 5,
          completedColor: "#00ff00",
          remainingColor: "#cccccc",
        },
        {
          id: "2",
          title: "Missing fields",
        },
      ],
    };

    const migrated = migrateToLatest(raw);
    expect(migrated.bars.length).toBe(1);
    expect(migrated.bars[0].id).toBe("1");
  });

  test("returns data as-is if already versioned", () => {
    const versioned: VersionedAppData = {
      version: 1,
      lastSynced: "2024-01-01T00:00:00Z",
      bars: [],
    };

    const result = migrateToLatest(versioned);
    expect(result).toBe(versioned);
  });

  test("handles non-object input gracefully", () => {
    const result = migrateToLatest(null);
    expect(result.version).toBe(1);
    expect(result.bars).toEqual([]);
  });
});
