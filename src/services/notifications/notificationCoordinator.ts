import * as Notifications from "expo-notifications";
import { queryTasks, updateTask } from "@/data/taskRepository";
import { scheduleTaskNotification, cancelTaskNotification } from "./notificationService";

export async function reconcileNotifications() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { scheduled: 0, cancelled: 0, skipped: true };
  const now = Date.now();
  const tasks = (await queryTasks()).filter(task => task.notifyEnabled && !task.completed && task.remindAt != null
    && task.remindAt > now && task.remindAt < now + 60 * 86400000)
    .sort((a, b) => a.remindAt! - b.remindAt!).slice(0, 64);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = new Set(scheduled.map(request => request.identifier));
  const retainedIds = new Set(tasks.map(task => task.notificationId).filter((id): id is string => !!id));
  let scheduledCount = 0; let cancelledCount = 0;
  for (const request of scheduled) {
    if (!retainedIds.has(request.identifier)) { await cancelTaskNotification(request.identifier); cancelledCount += 1; }
  }
  for (const task of tasks) {
    if (task.notificationId && existingIds.has(task.notificationId)) continue;
    const id = await scheduleTaskNotification(task);
    await updateTask(task.id, { notificationId: id });
    if (id) scheduledCount += 1;
  }
  return { scheduled: scheduledCount, cancelled: cancelledCount, skipped: false };
}
