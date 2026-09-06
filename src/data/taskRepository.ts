import { getDatabase } from "./database";
import type { CreateTaskInput, TaskOccurrence, UpdateTaskInput } from "./task";
import { expandRecurrence } from "./recurrence";
import { writeOperationLog } from "./operationLog";

type TaskRow = Record<string, unknown>;

const toTask = (row: TaskRow): TaskOccurrence => ({
  id: String(row.id),
  kind: row.kind as TaskOccurrence["kind"],
  content: String(row.content),
  eventAt: Number(row.event_at),
  eventDate: String(row.event_date),
  timezone: String(row.timezone),
  notifyEnabled: Number(row.notify_enabled) === 1,
  remindAt: row.remind_at == null ? null : Number(row.remind_at),
  notificationId: row.notification_id == null ? null : String(row.notification_id),
  images: row.images_json ? JSON.parse(String(row.images_json)) as string[] : [],
  recordings: row.recordings_json ? JSON.parse(String(row.recordings_json)) as string[] : [],
  completionSupported: Number(row.completion_supported) === 1,
  completed: Number(row.completed) === 1,
  completedAt: row.completed_at == null ? null : Number(row.completed_at),
  studentName: row.student_name == null ? null : String(row.student_name),
  leaveDate: row.leave_date == null ? null : String(row.leave_date),
  leavePeriod: row.leave_period == null ? null : Number(row.leave_period) as TaskOccurrence["leavePeriod"],
  status: row.status as TaskOccurrence["status"],
  recurrenceRule: row.recurrence_rule == null ? null : String(row.recurrence_rule),
  recurrenceGroupId: row.recurrence_group_id == null ? null : String(row.recurrence_group_id),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  version: Number(row.version),
});

export async function createTask(input: CreateTaskInput): Promise<TaskOccurrence> {
  const database = await getDatabase();
  const now = Date.now();
  const id = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  await database.runAsync(
    `INSERT INTO task_occurrences (
      id, kind, content, event_at, event_date, notify_enabled, remind_at,
      completion_supported, student_name, leave_date, leave_period, images_json, recordings_json,
      recurrence_rule, recurrence_group_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.kind,
    input.content,
    input.eventAt,
    input.eventDate,
    input.notifyEnabled ? 1 : 0,
    input.remindAt,
    input.completionSupported ? 1 : 0,
    input.studentName,
    input.leaveDate,
    input.leavePeriod,
    JSON.stringify(input.images ?? []),
    JSON.stringify(input.recordings ?? []),
    input.recurrenceRule,
    input.recurrenceGroupId,
    now,
    now,
  );
  const task = await getTask(id);
  if (!task) throw new Error("创建事务后无法读取记录");
  await writeOperationLog("create", "task_occurrence", id, { kind: input.kind });
  return task;
}

export async function createRecurringTasks(input: CreateTaskInput, until: number) {
  const groupId = input.recurrenceGroupId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const timestamps = expandRecurrence({ preset: input.recurrenceRule === "FREQ=DAILY" ? "daily" : input.recurrenceRule === "FREQ=WEEKLY" ? "weekly" : input.recurrenceRule === "FREQ=MONTHLY;BYMONTHDAY=-1" ? "monthEnd" : "monthly", startAt: input.eventAt, until });
  const created: TaskOccurrence[] = [];
  for (const eventAt of timestamps) {
    const date = new Date(eventAt); const eventDate = date.toISOString().slice(0, 10);
    created.push(await createTask({ ...input, eventAt, eventDate, remindAt: input.remindAt == null ? null : eventAt, recurrenceGroupId: groupId }));
  }
  return created;
}

export async function getTask(id: string) {
  const database = await getDatabase();
  const row = await database.getFirstAsync<TaskRow>(
    "SELECT * FROM task_occurrences WHERE id = ?",
    id,
  );
  return row ? toTask(row) : null;
}

export async function queryTasks(options: { from?: number; to?: number; keyword?: string } = {}) {
  const database = await getDatabase();
  const clauses = ["status = 'active'"];
  const args: (string | number)[] = [];
  if (options.from != null) { clauses.push("event_at >= ?"); args.push(options.from); }
  if (options.to != null) { clauses.push("event_at < ?"); args.push(options.to); }
  if (options.keyword?.trim()) { clauses.push("content LIKE ?"); args.push(`%${options.keyword.trim()}%`); }
  const rows = await database.getAllAsync<TaskRow>(
    `SELECT * FROM task_occurrences WHERE ${clauses.join(" AND ")} ORDER BY completed ASC, event_at ASC`,
    ...args,
  );
  return rows.map(toTask);
}

export async function updateTask(id: string, patch: UpdateTaskInput) {
  const database = await getDatabase();
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (!entries.length) return getTask(id);
  const fields = entries.map(([key]) => `${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)} = ?`);
  const values = entries.map(([, value]) => typeof value === "boolean" ? (value ? 1 : 0) : value);
  values.push(Date.now());
  values.push(id);
  await database.runAsync(
    `UPDATE task_occurrences SET ${fields.join(", ")}, updated_at = ?, version = version + 1 WHERE id = ?`,
    ...values,
  );
  await writeOperationLog("update", "task_occurrence", id, Object.keys(patch));
  return getTask(id);
}

export async function deleteTask(id: string) {
  const database = await getDatabase();
  await database.runAsync("UPDATE task_occurrences SET status = 'cancelled', updated_at = ?, version = version + 1 WHERE id = ?", Date.now(), id);
  await writeOperationLog("delete", "task_occurrence", id);
}

export async function cancelFutureIncomplete(groupId: string, from = Date.now()) {
  const database = await getDatabase();
  const result = await database.runAsync("UPDATE task_occurrences SET status = 'cancelled', cancellation_reason = 'recurrence_stopped', updated_at = ?, version = version + 1 WHERE recurrence_group_id = ? AND event_at >= ? AND completed = 0 AND status = 'active'", Date.now(), groupId, from);
  await writeOperationLog("stop_recurrence", "task_occurrence_group", groupId, { from });
  return result.changes;
}
