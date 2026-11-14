import { getDatabase } from "@/data/database";

import type { ClassroomConnection, ClassroomMessage, ClassroomMessageStatus } from "./classroomClient";

export type ClassroomHistoryItem = {
  messageId: string;
  classId: string;
  deviceId: string | null;
  deviceName: string | null;
  content: string;
  status: ClassroomMessageStatus;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

type ClassroomHistoryRow = {
  id: string;
  class_id: string;
  device_id: string | null;
  device_name: string | null;
  content: string;
  status: ClassroomMessageStatus;
  error_message: string | null;
  created_at: number;
  updated_at: number;
};

function historyRow(row: ClassroomHistoryRow): ClassroomHistoryItem {
  return {
    messageId: row.id,
    classId: row.class_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    content: row.content,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveClassroomMessageHistory(message: ClassroomMessage, connection: ClassroomConnection) {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO classroom_message_history
      (id, class_id, device_id, device_name, content, status, error_message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       device_id = excluded.device_id,
       device_name = excluded.device_name,
       status = excluded.status,
       error_message = excluded.error_message,
       updated_at = excluded.updated_at`,
    message.messageId,
    message.classId,
    connection.deviceId ?? null,
    connection.deviceName ?? null,
    message.content,
    message.status,
    message.errorMessage ?? null,
    message.createdAt,
    message.updatedAt,
  );
}

export async function listClassroomMessageHistory(classId: string, limit = 20) {
  const database = await getDatabase();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await database.getAllAsync<ClassroomHistoryRow>(
    `SELECT * FROM classroom_message_history
     WHERE class_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    classId,
    safeLimit,
  );
  return rows.map(historyRow);
}
