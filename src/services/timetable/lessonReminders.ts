import { getDatabase } from '@/data/database';
import type { TimetableLesson } from '@/data/school';
import { getTask, updateTask } from '@/data/taskRepository';
import { cancelTaskNotification, scheduleTaskNotification } from '@/services/notifications/notificationService';
import { lessonReminderPlan, validateLessonTimes } from './lessonReminderPlan';

const settingKey = 'timetable_lesson_start_times';
export async function loadLessonTimes(): Promise<string[]> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', settingKey);
  if (!row) return Array(8).fill('');
  return validateLessonTimes(JSON.parse(row.value));
}
export async function saveLessonTimes(times: string[]) {
  validateLessonTimes(times);
  const db = await getDatabase();
  await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', settingKey, JSON.stringify(times), Date.now());
}

// Serializing prevents rapid saves from scheduling multiple notifications for the same lesson.
let pending = Promise.resolve({ missingTimes: false, notificationFailed: false, lateReminder: false });
export function syncLessonReminders(timetableId: string, lessons: TimetableLesson[]) {
  const result = pending.catch(() => ({ missingTimes: false, notificationFailed: false, lateReminder: false })).then(async () => {
    const db = await getDatabase();
    const times = await loadLessonTimes();
    const missingTimes = times.some(time => !time);
    const now = new Date();
    const plan = missingTimes ? [] : lessonReminderPlan(timetableId, lessons, times, now);
    const prefix = `lesson-reminder:${timetableId}:`;
    const existing = await db.getAllAsync<{ id: string; notification_id: string | null }>(
      "SELECT id, notification_id FROM task_occurrences WHERE substr(id, 1, ?) = ? AND status = 'active' AND event_at > ?", prefix.length, prefix, now.getTime());
    for (const old of existing) {
      if (plan.some(item => item.id === old.id)) continue;
      await cancelTaskNotification(old.notification_id);
      await updateTask(old.id, { status: 'cancelled', notificationId: null });
    }
    let notificationFailed = false;
    for (const item of plan) {
      const old = await getTask(item.id);
      const changed = !old || old.status !== 'active' || old.content !== item.content || old.eventAt !== item.eventAt || old.remindAt !== item.remindAt;
      if (changed) {
        await cancelTaskNotification(old?.notificationId ?? null);
        await db.runAsync(`INSERT INTO task_occurrences
          (id, kind, content, event_at, event_date, notify_enabled, remind_at, completion_supported, created_at, updated_at)
          VALUES (?, 'normal', ?, ?, ?, 1, ?, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET content = excluded.content, event_at = excluded.event_at,
          event_date = excluded.event_date, remind_at = excluded.remind_at, notify_enabled = 1,
          notification_id = NULL, status = 'active', completed = 0, completed_at = NULL,
          updated_at = excluded.updated_at, version = version + 1`,
          item.id, item.content, item.eventAt, item.eventDate, item.remindAt, now.getTime(), now.getTime());
      }
      const task = await getTask(item.id);
      if (task && !task.completed && !task.notificationId && task.remindAt! > Date.now()) {
        try {
          const notificationId = await scheduleTaskNotification(task);
          if (notificationId) await updateTask(task.id, { notificationId });
          else notificationFailed = true;
        } catch { notificationFailed = true; }
      }
    }
    return { missingTimes, notificationFailed, lateReminder: plan.some(item => item.remindAt <= now.getTime()) };
  });
  pending = result;
  return result;
}
