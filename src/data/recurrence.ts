export type RecurrencePreset = "none" | "daily" | "weekly" | "monthly" | "monthEnd";

export interface RecurrenceOptions {
  preset: Exclude<RecurrencePreset, "none">;
  startAt: number;
  until: number;
}

export function presetToRRule(preset: RecurrencePreset) {
  if (preset === "daily") return "FREQ=DAILY";
  if (preset === "weekly") return "FREQ=WEEKLY";
  if (preset === "monthly") return "FREQ=MONTHLY;BYMONTHDAY=1";
  if (preset === "monthEnd") return "FREQ=MONTHLY;BYMONTHDAY=-1";
  return null;
}

export function rRuleToPreset(rule: string | null): RecurrencePreset {
  if (!rule) return "none";
  if (rule === "FREQ=DAILY") return "daily";
  if (rule === "FREQ=WEEKLY") return "weekly";
  if (rule === "FREQ=MONTHLY;BYMONTHDAY=-1") return "monthEnd";
  return "monthly";
}

function monthEnd(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }

export function expandRecurrence({ preset, startAt, until }: RecurrenceOptions) {
  const start = new Date(startAt); const end = new Date(until); const result: number[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const isValid = preset === "daily" || (preset === "weekly" && cursor.getDay() === start.getDay()) || (preset === "monthly" && cursor.getDate() === start.getDate()) || (preset === "monthEnd" && cursor.getDate() === monthEnd(cursor.getFullYear(), cursor.getMonth()));
    if (isValid) result.push(cursor.getTime());
    if (preset === "daily") cursor.setDate(cursor.getDate() + 1);
    else if (preset === "weekly") cursor.setDate(cursor.getDate() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
