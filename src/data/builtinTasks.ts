import { createTask, queryTasks } from "./taskRepository";
import { isReminderWorkday } from "@/services/calendar/workdayPolicy";
import { getHolidayCalendar } from "@/services/calendar/holidayCalendar";

function dateAt(year: number, month: number, day: number, hour: number, minute: number) { return new Date(year, month - 1, day, hour, minute).getTime(); }
function dateText(year: number, month: number, day: number) { return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }

export async function ensureBuiltinTasks(now = new Date()) {
  const year = now.getFullYear(); const calendar = getHolidayCalendar(year); const from = new Date(year, 0, 1).getTime(); const existing = await queryTasks({ from }); const existingKeys = new Set(existing.map((task) => `${task.content}-${task.eventAt}`));
  const candidates: Array<{ content: string; eventAt: number }> = [];
  for (let day = new Date(now.getFullYear(), now.getMonth(), now.getDate()); day.getFullYear() === year; day.setDate(day.getDate() + 1)) {
    const text = dateText(year, day.getMonth() + 1, day.getDate()); if (!isReminderWorkday(text, calendar)) continue;
    candidates.push({ content: "每天晨午检", eventAt: dateAt(year, day.getMonth() + 1, day.getDate(), 9, 1) });
    candidates.push({ content: "学生看餐", eventAt: dateAt(year, day.getMonth() + 1, day.getDate(), 11, 30) });
  }
  for (let month = now.getMonth(); month < 12; month += 1) {
    const last = new Date(year, month + 1, 0).getDate();
    const lastText = dateText(year, month + 1, last);
    if (isReminderWorkday(lastText, calendar)) { candidates.push({ content: "视力检查表", eventAt: dateAt(year, month + 1, last, 8, 10) }); candidates.push({ content: "更换板报", eventAt: dateAt(year, month + 1, last, 8, 10) }); }
    for (let day = Math.max(1, last - 4); day <= last; day += 1) { const text = dateText(year, month + 1, day); if (isReminderWorkday(text, calendar)) candidates.push({ content: "通风消毒记录", eventAt: dateAt(year, month + 1, day, 8, 10) }); }
  }
  for (const item of candidates) if (!existingKeys.has(`${item.content}-${item.eventAt}`)) { const date = new Date(item.eventAt); const group = item.content === "通风消毒记录" ? `builtin-${item.content}-${date.getFullYear()}-${date.getMonth() + 1}` : `builtin-${item.content}`; await createTask({ kind: "normal", content: item.content, eventAt: item.eventAt, eventDate: dateText(year, date.getMonth() + 1, date.getDate()), notifyEnabled: true, remindAt: item.eventAt, completionSupported: true, studentName: null, leaveDate: null, leavePeriod: null, recurrenceRule: "BUILTIN", recurrenceGroupId: group, images: [], recordings: [] }); }
}
