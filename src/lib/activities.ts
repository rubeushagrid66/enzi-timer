export type Activity = {
  id: string;
  name: string;
  /** total duration in seconds */
  durationSeconds: number;
  createdAt: number;
};

export const DEFAULT_ACTIVITIES: Activity[] = [
  { id: "default-focus", name: "Focus", durationSeconds: 25 * 60, createdAt: 1 },
  { id: "default-break", name: "Short Break", durationSeconds: 5 * 60, createdAt: 2 },
  { id: "default-deep", name: "Deep Work", durationSeconds: 50 * 60, createdAt: 3 },
];

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  if (h > 0) return `${String(h).padStart(2, "0")}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function formatDurationLong(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

const LOCAL_KEY = "enzi-timer-activities-v1";

export function loadLocalActivities(): Activity[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Activity[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.filter((a) => a && a.name && a.durationSeconds > 0);
  } catch {
    return null;
  }
}

export function saveLocalActivities(list: Activity[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable — timer still works in-memory
  }
}
