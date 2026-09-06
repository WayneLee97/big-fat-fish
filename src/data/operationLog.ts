import { getDatabase } from "./database";

export async function writeOperationLog(action: string, entityType: string, entityId: string | null, payload?: unknown) {
  const database = await getDatabase();
  await database.runAsync("INSERT INTO operation_events (id, action, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)", `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, action, entityType, entityId, payload == null ? null : JSON.stringify(payload), Date.now());
}

export async function cleanupOldOperationLogs(now = Date.now()) {
  const date = new Date(now); date.setMonth(date.getMonth() - 1); date.setDate(1); date.setHours(0, 0, 0, 0);
  const database = await getDatabase();
  await database.runAsync("DELETE FROM operation_events WHERE created_at < ?", date.getTime());
}
