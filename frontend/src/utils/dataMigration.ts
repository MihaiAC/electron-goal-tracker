// This would become horrible to maintain pretty fast.
// Should probably just use a proper DB / something with automatic migrations.
import type { VersionedAppData } from "../../../types/shared";

interface ProgressBarDataV1 {
  id: string;
  title: string;
  current: number;
  max: number;
  unit: string;
  incrementDelta: number;
  completedColor: string;
  remainingColor: string;
}

function isProgressBarDataV1(obj: unknown): obj is ProgressBarDataV1 {
  if (typeof obj !== "object" || obj === null) return false;

  const bar = obj as Record<string, unknown>;
  return (
    typeof bar.id === "string" &&
    typeof bar.title === "string" &&
    typeof bar.current === "number" &&
    typeof bar.max === "number" &&
    typeof bar.unit === "string" &&
    typeof bar.incrementDelta === "number" &&
    typeof bar.completedColor === "string" &&
    typeof bar.remainingColor === "string"
  );
}

export function validateVersionedData(data: unknown): data is VersionedAppData {
  if (typeof data !== "object" || data === null) return false;

  const versioned = data as Partial<VersionedAppData>;
  if (typeof versioned.version !== "number") return false;
  if (
    versioned.lastSynced !== undefined &&
    typeof versioned.lastSynced !== "string"
  )
    return false;
  if (!Array.isArray(versioned.bars)) return false;

  return versioned.bars.every(isProgressBarDataV1);
}

// Will need to be updated later to go through old versions of ProgressBarData.
export function migrateToLatest(data: unknown): VersionedAppData {
  // Empty data or non-object data(?).
  if (data === null || typeof data !== "object") {
    return {
      version: 1,
      lastSynced: new Date().toISOString(),
      bars: [],
    };
  }

  // Old unversioned data
  if (!("version" in data)) {
    const rawBars = (data as Record<string, unknown>).bars;
    const bars = Array.isArray(rawBars)
      ? rawBars.filter(isProgressBarDataV1)
      : [];

    return {
      version: 1,
      lastSynced: new Date().toISOString(),
      bars,
    };
  }

  // Already versioned data
  if (validateVersionedData(data)) {
    return data;
  }

  // If we get here, the data is invalid.
  console.log("Invalid data, returning default app data.");
  return {
    version: 1,
    lastSynced: new Date().toISOString(),
    bars: [],
  };
}
