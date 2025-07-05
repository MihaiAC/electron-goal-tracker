export interface ProgressBarData {
  id: string;
  title: string;
  current: number;
  max: number;
  unit: string;
  incrementDelta: number;
  completedColor: string;
  remainingColor: string;
}

export interface AppData {
  bars: ProgressBarData[];
}

export interface SaveResult {
  success: boolean;
  path: string;
}
