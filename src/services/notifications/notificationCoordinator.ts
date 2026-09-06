import * as Notifications from "expo-notifications";
import { queryTasks, updateTask } from "@/data/taskRepository";
import { scheduleTaskNotification, cancelTaskNotification } from "./notificationService";

export async function reconcileNotifications() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { scheduled: 0, cancelled: 0, skipped: true };
  const tasks = await queryTasks({ from: Date.now(), to: Date.now() + 60 * 86400000 });
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const validIds = new Set<string>(); let scheduledCount = 0; let cancelledCount = 0;
  for (const task of tasks.slice(0, 64)) {
    if (task.notificationId) { validIds.add(task.notificationId); continue; }
    const id = await scheduleTaskNotification(task); if (id) { await updateTask(task.id, { notificationId: id }); validIds.add(id); scheduledCount += 1; }
  }
  for (const request of scheduled) if (!validIds.has(request.identifier)) { await cancelTaskNotification(request.identifier); cancelledCount += 1; }
  return { scheduled: scheduledCount, cancelled: cancelledCount, skipped: false };
}
