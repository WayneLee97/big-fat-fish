export const SCHEMA_VERSION = 5;

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

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL,
  student_number TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(class_id, student_number),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_students_class_name ON students(class_id, name);

CREATE TABLE IF NOT EXISTS timetables (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('teacher', 'class')),
  class_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  CHECK ((kind = 'teacher' AND class_id IS NULL) OR (kind = 'class' AND class_id IS NOT NULL)),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_teacher_timetable ON timetables(kind) WHERE kind = 'teacher';

CREATE TABLE IF NOT EXISTS timetable_lessons (
  id TEXT PRIMARY KEY NOT NULL,
  timetable_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 5),
  period INTEGER NOT NULL CHECK (period BETWEEN 1 AND 8),
  subject TEXT NOT NULL,
  room TEXT,
  note TEXT,
  teaching_class_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(timetable_id, weekday, period),
  FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE,
  FOREIGN KEY (teaching_class_id) REFERENCES classes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_timetable_lessons_timetable ON timetable_lessons(timetable_id, weekday, period);

CREATE TABLE IF NOT EXISTS timetable_adjustments (
  id TEXT PRIMARY KEY NOT NULL,
  timetable_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 5),
  period INTEGER NOT NULL CHECK (period BETWEEN 1 AND 8),
  subject TEXT NOT NULL,
  room TEXT,
  note TEXT,
  teaching_class_id TEXT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('temporary', 'long_term')),
  effective_from INTEGER NOT NULL,
  effective_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(timetable_id, weekday, period, effective_from),
  FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE,
  FOREIGN KEY (teaching_class_id) REFERENCES classes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_timetable_adjustments_active ON timetable_adjustments(timetable_id, effective_from, effective_until);

CREATE TABLE IF NOT EXISTS student_records (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL,
  student_id TEXT,
  student_name_snapshot TEXT NOT NULL,
  student_number_snapshot TEXT NOT NULL,
  class_name_snapshot TEXT NOT NULL,
  record_date TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  images_json TEXT NOT NULL DEFAULT '[]',
  recordings_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_student_records_class_date ON student_records(class_id, record_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_records_student_date ON student_records(student_id, record_date DESC);

CREATE TABLE IF NOT EXISTS classroom_message_history (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL,
  device_id TEXT,
  device_name TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'displaying', 'speaking', 'played', 'failed', 'expired', 'duplicate')),
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_classroom_message_history_class_created
  ON classroom_message_history(class_id, created_at DESC);
`;
