import * as SQLite from "expo-sqlite";

import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function openAndMigrate() {
  const database = await SQLite.openDatabaseAsync("big-fat-fish.db");
  await database.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  await database.execAsync(SCHEMA_SQL);
  try { await database.execAsync("ALTER TABLE task_occurrences ADD COLUMN notification_id TEXT;"); } catch { /* column already exists */ }
  try { await database.execAsync("ALTER TABLE task_occurrences ADD COLUMN images_json TEXT;"); } catch { /* column already exists */ }
  try { await database.execAsync("ALTER TABLE task_occurrences ADD COLUMN recordings_json TEXT;"); } catch { /* column already exists */ }

  const migration = await database.getFirstAsync<{ version: number }>(
    "SELECT MAX(version) AS version FROM schema_migrations",
  );
  const currentVersion = migration?.version ?? 0;
  if (currentVersion < SCHEMA_VERSION) {
    await database.runAsync(
      "INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      SCHEMA_VERSION,
      Date.now(),
    );
  }
  return database;
}

export function getDatabase() {
  databasePromise ??= openAndMigrate().catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}
