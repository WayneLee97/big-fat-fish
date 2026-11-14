import { getDatabase } from '@/data/database';
import { getTask, updateTask } from '@/data/taskRepository';
import { scheduleTaskNotification } from '@/services/notifications/notificationService';
import { localTimestamp, type Suggestion } from './contract';

export async function confirmSuggestions(items: Suggestion[], source: string) {
  if (!items.length) throw new Error('请先选择事项');
  const prepared = items.map(item => {
    if (!item.title.trim() || item.title.length > 5000) throw new Error('请填写事项内容（最多5000字）');
    return { ...item, eventAt: localTimestamp(item.date ?? '', item.time ?? '') };
  });
  const database = await getDatabase();
  const ids: string[] = [];
  let duplicates = 0;
  await database.withExclusiveTransactionAsync(async tx => {
    await tx.execAsync('CREATE TABLE IF NOT EXISTS ai_task_sources (task_id TEXT PRIMARY KEY REFERENCES task_occurrences(id), source TEXT NOT NULL, evidence TEXT NOT NULL, relevance TEXT NOT NULL)');
    for (const item of prepared) {
      const existing = await tx.getFirstAsync('SELECT id FROM task_occurrences WHERE status = ? AND content = ? AND event_at = ?', 'active', item.title.trim(), item.eventAt);
      if (existing) { duplicates++; continue; }
      const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const now = Date.now();
      await tx.runAsync(`INSERT INTO task_occurrences
        (id, kind, content, event_at, event_date, timezone, notify_enabled, remind_at, completion_supported, images_json, recordings_json, created_at, updated_at)
        VALUES (?, 'normal', ?, ?, ?, ?, 1, ?, 1, '[]', '[]', ?, ?)`,
        id, item.title.trim(), item.eventAt, item.date!, Intl.DateTimeFormat().resolvedOptions().timeZone, item.eventAt, now, now);
      await tx.runAsync('INSERT INTO ai_task_sources (task_id, source, evidence, relevance) VALUES (?, ?, ?, ?)', id, source, item.evidence, item.relevance);
      ids.push(id);
    }
  });
  let remindersFailed = 0;
  for (const id of ids) {
    try {
      const task = await getTask(id);
      if (!task) continue;
      const notificationId = await scheduleTaskNotification(task);
      if (notificationId) await updateTask(id, { notificationId });
      else if (task.eventAt > Date.now()) remindersFailed++;
    } catch { remindersFailed++; }
  }
  return { added: ids.length, duplicates, remindersFailed };
}
