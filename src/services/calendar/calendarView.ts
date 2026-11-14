import type { TaskOccurrence } from '../../data/task';

export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function weekStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7);
}
export function periodDays(date: Date, mode: 'week' | 'month') {
  const start = mode === 'month' ? new Date(date.getFullYear(), date.getMonth(), 1) : weekStart(date);
  const count = mode === 'month' ? new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() : 7;
  return Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
export function movePeriod(date: Date, mode: 'week' | 'month', delta: number) {
  if (mode === 'week') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta * 7);
  const start = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  return new Date(start.getFullYear(), start.getMonth(), Math.min(date.getDate(), new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
}
export function needsManualReminder(task: TaskOccurrence, now = new Date()) {
  const start = weekStart(now);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  // Existing creation paths identify imports by id and generated tasks by recurrence metadata.
  return task.status === 'active' && !task.completed && task.kind !== 'school_milestone'
    && !task.id.startsWith('lesson-reminder:') && !task.id.startsWith('ai-') && task.recurrenceRule !== 'BUILTIN'
    && !task.recurrenceGroupId?.startsWith('builtin-')
    && task.eventDate >= dateKey(start) && task.eventDate < dateKey(end);
}
