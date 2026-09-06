import type { HolidayCalendarData } from "./workdayPolicy";

export interface HolidayEvent {
  key: string;
  name: string;
  start: string;
  end: string;
  date: string;
  type: "statutory" | "supplementary";
}

const HOLIDAY_EVENTS_2026: HolidayEvent[] = [
  { key: "new_year", name: "元旦", start: "2026-01-01", end: "2026-01-03", date: "2026-01-01", type: "statutory" },
  { key: "spring_festival", name: "春节", start: "2026-02-15", end: "2026-02-23", date: "2026-02-17", type: "statutory" },
  { key: "qingming", name: "清明节", start: "2026-04-04", end: "2026-04-06", date: "2026-04-05", type: "statutory" },
  { key: "labour", name: "劳动节", start: "2026-05-01", end: "2026-05-05", date: "2026-05-01", type: "statutory" },
  { key: "dragon_boat", name: "端午节", start: "2026-06-19", end: "2026-06-21", date: "2026-06-19", type: "statutory" },
  { key: "mid_autumn", name: "中秋节", start: "2026-09-25", end: "2026-09-27", date: "2026-09-25", type: "statutory" },
  { key: "national_day", name: "国庆节", start: "2026-10-01", end: "2026-10-07", date: "2026-10-01", type: "statutory" },
  { key: "children", name: "儿童节", start: "2026-06-01", end: "2026-06-01", date: "2026-06-01", type: "supplementary" },
];

const MAKEUP_WORKDAYS_2026 = ["2026-01-04", "2026-02-14", "2026-02-28", "2026-05-09", "2026-09-20", "2026-10-10"];

function expandRange(start: string, end: string) { const result: string[] = []; const date = new Date(`${start}T12:00:00`); const last = new Date(`${end}T12:00:00`); while (date <= last) { result.push(date.toISOString().slice(0, 10)); date.setDate(date.getDate() + 1); } return result; }

export function getHolidayEvents(year: number) { return year === 2026 ? HOLIDAY_EVENTS_2026 : []; }

export function getHolidayCalendar(year: number): HolidayCalendarData {
  const events = getHolidayEvents(year).filter((event) => event.type === "statutory");
  return { holidayDates: events.flatMap((event) => expandRange(event.start, event.end)), makeupWorkdays: year === 2026 ? MAKEUP_WORKDAYS_2026 : [], vacationRanges: [] };
}

export function getNearestHoliday(year: number, today: string) { return getHolidayEvents(year).filter((event) => event.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null; }
