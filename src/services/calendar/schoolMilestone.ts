import { getDatabase } from "@/data/database";
import { nextDefaultMilestone } from "./schoolCalendar";
import { createTask } from "@/data/taskRepository";

export interface SchoolMilestone { key: string; label: string; date: string; days: number; }

export async function findMissingSchoolMilestone(now = new Date()): Promise<SchoolMilestone | null> {
  const target = nextDefaultMilestone(now); if (!target) return null;
  const database = await getDatabase(); const row = await database.getFirstAsync<{ id: string }>("SELECT id FROM task_occurrences WHERE kind = 'school_milestone' AND event_date = ? AND status = 'active'", target.date);
  return row ? null : target;
}

export async function saveSchoolMilestone(milestone: SchoolMilestone, date: string) {
  const eventAt = new Date(`${date}T00:00:00`).getTime();
  return createTask({ kind: "school_milestone", content: milestone.label, eventAt, eventDate: date, notifyEnabled: false, remindAt: null, completionSupported: false, studentName: null, leaveDate: null, leavePeriod: null, recurrenceRule: null, recurrenceGroupId: null, images: [], recordings: [] });
}
