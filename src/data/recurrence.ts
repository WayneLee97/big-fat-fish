export type RecurrencePreset = "none" | "daily" | "weekly" | "monthly" | "monthEnd";

export interface RecurrenceOptions {
  preset: Exclude<RecurrencePreset, "none">;
  startAt: number;
  until: number;
  rule?: string | null;
  weeklyDays?: number[];
  monthlyDays?: number[];
}

const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function jsDayToRRuleDay(value: number) {
  return value === 0 ? 7 : value;
}

export function presetToRRule(preset: RecurrencePreset, weeklyDays: number[] = [], monthlyDays: number[] = []) {
  if (preset === "daily") return "FREQ=DAILY";
  if (preset === "weekly") {
    const days = [...new Set(weeklyDays)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
    return days.length ? `FREQ=WEEKLY;BYDAY=${days.map((day) => WEEKDAY_CODES[day - 1]).join(",")}` : "FREQ=WEEKLY";
  }
  if (preset === "monthly") {
    const days = [...new Set(monthlyDays)].filter((day) => day >= 1 && day <= 31).sort((a, b) => a - b);
    return `FREQ=MONTHLY;BYMONTHDAY=${days.length ? days.join(",") : "1"}`;
  }
  if (preset === "monthEnd") return "FREQ=MONTHLY;BYMONTHDAY=-1";
  return null;
}

export function rRuleToPreset(rule: string | null): RecurrencePreset {
  if (!rule) return "none";
  if (rule === "FREQ=DAILY") return "daily";
  if (rule === "FREQ=WEEKLY" || rule.startsWith("FREQ=WEEKLY;")) return "weekly";
  if (rule === "FREQ=MONTHLY;BYMONTHDAY=-1") return "monthEnd";
  return "monthly";
}

function parseRuleDays(rule: string | null | undefined) {
  const weekly = rule?.match(/BYDAY=([^;]+)/)?.[1]
    ?.split(",")
    .map((value) => WEEKDAY_CODES.indexOf(value) + 1)
    .filter((value) => value >= 1 && value <= 7);
  const monthly = rule?.match(/BYMONTHDAY=([^;]+)/)?.[1]
    ?.split(",")
    .map(Number)
    .filter((value) => value >= 1 && value <= 31);
  return { weekly, monthly };
}

function monthEnd(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }

export function expandRecurrence({ preset, startAt, until, rule, weeklyDays, monthlyDays }: RecurrenceOptions) {
  const start = new Date(startAt); const end = new Date(until); const result: number[] = [];
  const parsed = parseRuleDays(rule);
  const selectedWeeklyDays = weeklyDays ?? parsed.weekly;
  const selectedMonthlyDays = monthlyDays ?? parsed.monthly;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const isValid = preset === "daily" ||
      (preset === "weekly" && (selectedWeeklyDays?.length ? selectedWeeklyDays.includes(jsDayToRRuleDay(cursor.getDay())) : cursor.getDay() === start.getDay())) ||
      (preset === "monthly" && (selectedMonthlyDays?.length ? selectedMonthlyDays.includes(cursor.getDate()) : cursor.getDate() === start.getDate())) ||
      (preset === "monthEnd" && cursor.getDate() === monthEnd(cursor.getFullYear(), cursor.getMonth()));
    if (isValid) result.push(cursor.getTime());
    if (preset === "daily") cursor.setDate(cursor.getDate() + 1);
    else if (preset === "weekly") cursor.setDate(cursor.getDate() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
