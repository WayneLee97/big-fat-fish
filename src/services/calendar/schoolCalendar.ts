import { countdownDays } from "./workdayPolicy";
import { getNearestHoliday } from "./holidayCalendar";

export const SCHOOL_PHASE_DEFAULTS = [
  { key: "winter_start", month: 1, day: 18, label: "寒假开始" },
  { key: "spring_start", month: 2, day: 21, label: "春季学期开学" },
  { key: "summer_start", month: 7, day: 8, label: "暑假开始" },
  { key: "autumn_start", month: 9, day: 1, label: "秋季学期开学" },
] as const;

export const HOLIDAY_NAMES = [
  { key: "new_year", month: 1, day: 1, label: "元旦" },
  { key: "labour", month: 5, day: 1, label: "劳动节" },
  { key: "children", month: 6, day: 1, label: "儿童节" },
  { key: "national", month: 10, day: 1, label: "国庆节" },
] as const;

export function nextDefaultMilestone(now = new Date()) {
  const candidates = SCHOOL_PHASE_DEFAULTS.flatMap((node) => [now.getFullYear(), now.getFullYear() + 1].map((year) => ({ ...node, date: `${year}-${String(node.month).padStart(2, "0")}-${String(node.day).padStart(2, "0")}` }))).filter((node) => node.date > now.toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date));
  const target = candidates[0];
  return target ? { ...target, days: countdownDays(target.date, now) } : null;
}

export function nextHoliday(now = new Date()) {
  const official = getNearestHoliday(now.getFullYear(), now.toISOString().slice(0, 10));
  if (official) return { ...official, label: official.name, days: countdownDays(official.date, now) };
  const candidates = HOLIDAY_NAMES.flatMap((holiday) => [now.getFullYear(), now.getFullYear() + 1].map((year) => ({ ...holiday, date: `${year}-${String(holiday.month).padStart(2, "0")}-${String(holiday.day).padStart(2, "0")}` }))).filter((holiday) => holiday.date >= now.toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date));
  const target = candidates[0];
  return target ? { ...target, days: countdownDays(target.date, now) } : null;
}
