export const SCHEMA_VERSION = 2;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('normal', 'leave', 'school_milestone')),
  content TEXT NOT NULL,
  event_at INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  notify_enabled INTEGER NOT NULL DEFAULT 1,
  remind_at INTEGER,
  notification_id TEXT,
  images_json TEXT,
  recordings_json TEXT,
  completion_supported INTEGER NOT NULL DEFAULT 1,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  student_name TEXT,
  leave_date TEXT,
  leave_period INTEGER CHECK (leave_period IN (0, 1, 2)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  recurrence_rule TEXT,
  recurrence_group_id TEXT,
  cancellation_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_task_occurrences_event_at
  ON task_occurrences(event_at);
CREATE INDEX IF NOT EXISTS idx_task_occurrences_event_date
  ON task_occurrences(event_date);
CREATE INDEX IF NOT EXISTS idx_task_occurrences_kind_status
  ON task_occurrences(kind, status);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'audio')),
  relative_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS occurrence_attachments (
  occurrence_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (occurrence_id, asset_id),
  FOREIGN KEY (occurrence_id) REFERENCES task_occurrences(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_events (
  id TEXT PRIMARY KEY NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operation_events_created_at
  ON operation_events(created_at);
`;
