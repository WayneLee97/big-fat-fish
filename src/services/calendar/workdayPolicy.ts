export interface HolidayCalendarData {
  holidayDates: string[];
  makeupWorkdays: string[];
  vacationRanges: Array<{ start: string; end: string }>;
}

import { getHolidayCalendar } from "./holidayCalendar";

const emptyCalendar: HolidayCalendarData = { holidayDates: [], makeupWorkdays: [], vacationRanges: [] };
const asDate = (value: string | Date) => typeof value === "string" ? value : value.toISOString().slice(0, 10);

export function isReminderWorkday(value: string | Date, calendar?: HolidayCalendarData) {
  const selectedCalendar = calendar ?? getHolidayCalendar(new Date(asDate(value)).getFullYear());
  const date = asDate(value); const weekday = new Date(`${date}T12:00:00`).getDay();
  if (selectedCalendar.vacationRanges.some((range) => date >= range.start && date <= range.end)) return false;
  if (selectedCalendar.makeupWorkdays.includes(date)) return true;
  if (selectedCalendar.holidayDates.includes(date)) return false;
  return weekday !== 0 && weekday !== 6;
}

export function countdownDays(targetDate: string, now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const target = new Date(`${targetDate}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
