import * as Notifications from "expo-notifications";
import type { TaskOccurrence } from "@/data/task";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleTaskNotification(task: TaskOccurrence) {
  if (!task.notifyEnabled || !task.remindAt || task.remindAt <= Date.now()) return null;
  if (!(await requestNotificationPermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: "班主任工作台", body: task.content, data: { occurrenceId: task.id, schemaVersion: 1 } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(task.remindAt) },
  });
}

export async function cancelTaskNotification(notificationId: string | null) {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
}
