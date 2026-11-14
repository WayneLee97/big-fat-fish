import { syncLessonReminders } from "@/services/timetable/lessonReminders";
import { getDatabase } from "./database";
import type { SchoolClass, Student, StudentRecord, TimetableLesson } from "./school";

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
const classRow = (row: Record<string, unknown>): SchoolClass => ({ id: String(row.id), name: String(row.name), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at), version: Number(row.version), studentCount: row.student_count == null ? undefined : Number(row.student_count) });
const studentRow = (row: Record<string, unknown>): Student => ({ id: String(row.id), classId: String(row.class_id), studentNumber: String(row.student_number), name: String(row.name), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at), version: Number(row.version) });
const recordRow = (row: Record<string, unknown>): StudentRecord => ({ id: String(row.id), classId: String(row.class_id), studentId: row.student_id == null ? null : String(row.student_id), studentName: String(row.student_name_snapshot), studentNumber: String(row.student_number_snapshot), className: String(row.class_name_snapshot), recordDate: String(row.record_date), content: String(row.content), images: JSON.parse(String(row.images_json ?? "[]")), recordings: JSON.parse(String(row.recordings_json ?? "[]")), createdAt: Number(row.created_at) });

export async function listClasses() { const db = await getDatabase(); return (await db.getAllAsync<Record<string, unknown>>("SELECT c.*, COUNT(s.id) AS student_count FROM classes c LEFT JOIN students s ON s.class_id = c.id GROUP BY c.id ORDER BY c.created_at, c.id")).map(classRow); }
export async function createClass(name: string) { const clean = normalize(name); if (!clean || clean.length > 30) throw new Error("班级名称需为 1–30 个字符"); const db = await getDatabase(); const now = Date.now(); const classId = id(); try { await db.withExclusiveTransactionAsync(async tx => { await tx.runAsync("INSERT INTO classes (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", classId, clean, clean.toLocaleLowerCase("zh-CN"), now, now); await tx.runAsync("INSERT INTO timetables (id, kind, class_id, created_at, updated_at) VALUES (?, 'class', ?, ?, ?)", id(), classId, now, now); }); } catch { throw new Error("班级名称已存在"); } return (await listClasses()).find(item => item.id === classId)!; }
export async function listStudents(classId: string, keyword = "") { const db = await getDatabase(); const query = normalize(keyword); const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM students WHERE class_id = ? ${query ? "AND name LIKE ?" : ""} ORDER BY CAST(student_number AS INTEGER), student_number, created_at, id`, ...(query ? [classId, `%${query}%`] : [classId])); return rows.map(studentRow); }
export async function saveStudent(input: { id?: string; classId: string; name: string; studentNumber: string }) { const name = normalize(input.name); const studentNumber = normalize(input.studentNumber); if (!name || !studentNumber || name.length > 30 || studentNumber.length > 30) throw new Error("请填写姓名和学号（最多 30 个字符）"); const db = await getDatabase(); const now = Date.now(); try { if (input.id) await db.runAsync("UPDATE students SET name = ?, student_number = ?, updated_at = ?, version = version + 1 WHERE id = ? AND class_id = ?", name, studentNumber, now, input.id, input.classId); else await db.runAsync("INSERT INTO students (id, class_id, student_number, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", id(), input.classId, studentNumber, name, now, now); } catch { throw new Error("该班级已有相同学号"); } }
export async function deleteStudent(studentId: string) { const db = await getDatabase(); await db.runAsync("DELETE FROM students WHERE id = ?", studentId); }
export async function deleteClass(classId: string) { const db = await getDatabase(); await db.withExclusiveTransactionAsync(async tx => { await tx.runAsync("DELETE FROM classes WHERE id = ?", classId); }); }
export async function classDeleteSummary(classId: string) { const db = await getDatabase(); const row = await db.getFirstAsync<{ students: number; lessons: number; records: number }>("SELECT (SELECT COUNT(*) FROM students WHERE class_id = ?) students, (SELECT COUNT(*) FROM timetable_lessons l JOIN timetables t ON t.id = l.timetable_id WHERE t.class_id = ?) lessons, (SELECT COUNT(*) FROM student_records WHERE class_id = ?) records", classId, classId, classId); return row ?? { students: 0, lessons: 0, records: 0 }; }
export async function getLessons(kind: "teacher" | "class", classId?: string, at = Date.now()) { const db = await getDatabase(); let timetable = await db.getFirstAsync<{ id: string }>(kind === "teacher" ? "SELECT id FROM timetables WHERE kind = 'teacher'" : "SELECT id FROM timetables WHERE kind = 'class' AND class_id = ?", ...(kind === "teacher" ? [] : [classId!])); if (!timetable && kind === "teacher") { const now = Date.now(); const timetableId = id(); await db.runAsync("INSERT INTO timetables (id, kind, class_id, created_at, updated_at) VALUES (?, 'teacher', NULL, ?, ?)", timetableId, now, now); timetable = { id: timetableId }; } if (!timetable) return { timetableId: null, lessons: [] as TimetableLesson[] }; const rows = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM timetable_lessons WHERE timetable_id = ? ORDER BY weekday, period", timetable.id); const adjustments = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM timetable_adjustments WHERE timetable_id = ? AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?) ORDER BY effective_from DESC", timetable.id, at, at); const bySlot = new Map<string, TimetableLesson>(); rows.forEach(row => bySlot.set(`${row.weekday}-${row.period}`, { id: String(row.id), timetableId: String(row.timetable_id), weekday: Number(row.weekday), period: Number(row.period), subject: String(row.subject), room: row.room == null ? null : String(row.room), note: row.note == null ? null : String(row.note), teachingClassId: row.teaching_class_id == null ? null : String(row.teaching_class_id), adjustmentType: null, effectiveFrom: null, effectiveUntil: null })); adjustments.forEach(row => { const key = `${row.weekday}-${row.period}`; if (bySlot.get(key)?.adjustmentType) return; bySlot.set(key, { id: String(row.id), timetableId: String(row.timetable_id), weekday: Number(row.weekday), period: Number(row.period), subject: String(row.subject), room: row.room == null ? null : String(row.room), note: row.note == null ? null : String(row.note), teachingClassId: row.teaching_class_id == null ? null : String(row.teaching_class_id), adjustmentType: row.adjustment_type as TimetableLesson["adjustmentType"], effectiveFrom: Number(row.effective_from), effectiveUntil: row.effective_until == null ? null : Number(row.effective_until) }); }); return { timetableId: timetable.id, lessons: Array.from(bySlot.values()).sort((a, b) => a.weekday - b.weekday || a.period - b.period) }; }
async function persistLesson(input: { timetableId: string; weekday: number; period: number; subject: string; room?: string; note?: string; teachingClassId?: string | null; adjustmentType?: "temporary" | "long_term"; effectiveFrom?: number; effectiveUntil?: number | null }) { const subject = normalize(input.subject); if (!subject || subject.length > 30) throw new Error("课程名称需为 1–30 个字符"); const db = await getDatabase(); const now = Date.now(); const room = normalize(input.room ?? "") || null; const note = normalize(input.note ?? "") || null; const teachingClassId = input.teachingClassId ?? null; if (input.adjustmentType === "temporary") { const effectiveFrom = input.effectiveFrom ?? now; await db.runAsync("INSERT INTO timetable_adjustments (id, timetable_id, weekday, period, subject, room, note, teaching_class_id, adjustment_type, effective_from, effective_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'temporary', ?, ?, ?, ?) ON CONFLICT(timetable_id, weekday, period, effective_from) DO UPDATE SET subject = excluded.subject, room = excluded.room, note = excluded.note, teaching_class_id = excluded.teaching_class_id, effective_until = excluded.effective_until, updated_at = excluded.updated_at, version = version + 1", id(), input.timetableId, input.weekday, input.period, subject, room, note, teachingClassId, effectiveFrom, input.effectiveUntil ?? null, now, now); return; } const existing = await db.getFirstAsync<{ id: string }>("SELECT id FROM timetable_lessons WHERE timetable_id = ? AND weekday = ? AND period = ?", input.timetableId, input.weekday, input.period); if (existing) await db.runAsync("UPDATE timetable_lessons SET subject = ?, room = ?, note = ?, teaching_class_id = ?, updated_at = ?, version = version + 1 WHERE id = ?", subject, room, note, teachingClassId, now, existing.id); else await db.runAsync("INSERT INTO timetable_lessons (id, timetable_id, weekday, period, subject, room, note, teaching_class_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id(), input.timetableId, input.weekday, input.period, subject, room, note, teachingClassId, now, now); if (input.adjustmentType === "long_term") await db.runAsync("INSERT INTO timetable_adjustments (id, timetable_id, weekday, period, subject, room, note, teaching_class_id, adjustment_type, effective_from, effective_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'long_term', ?, NULL, ?, ?)", id(), input.timetableId, input.weekday, input.period, subject, room, note, teachingClassId, input.effectiveFrom ?? now, now, now); }
async function removeLesson(input: { timetableId: string; weekday: number; period: number; adjustmentType?: TimetableLesson["adjustmentType"] }) { const db = await getDatabase(); if (input.adjustmentType === "temporary") { await db.runAsync("DELETE FROM timetable_adjustments WHERE timetable_id = ? AND weekday = ? AND period = ? AND adjustment_type = 'temporary' AND effective_from <= ? AND (effective_until IS NULL OR effective_until > ?)", input.timetableId, input.weekday, input.period, Date.now(), Date.now()); return; } await db.runAsync("DELETE FROM timetable_lessons WHERE timetable_id = ? AND weekday = ? AND period = ?", input.timetableId, input.weekday, input.period); await db.runAsync("DELETE FROM timetable_adjustments WHERE timetable_id = ? AND weekday = ? AND period = ?", input.timetableId, input.weekday, input.period); }
export async function refreshLessonReminders() {
  const { timetableId, lessons } = await getLessons("teacher");
  if (timetableId) return syncLessonReminders(timetableId, lessons);
}
export async function saveLesson(input: Parameters<typeof persistLesson>[0]) {
  await persistLesson(input);
  if (input.adjustmentType) return refreshLessonReminders();
}
export async function deleteLesson(input: Parameters<typeof removeLesson>[0]) {
  await removeLesson(input);
  return refreshLessonReminders();
}
export async function createStudentRecord(input: { classId: string; studentId: string; recordDate: string; content: string; images: string[]; recordings: string[] }) { const db = await getDatabase(); const student = await db.getFirstAsync<{ name: string; student_number: string; class_name: string }>("SELECT s.name, s.student_number, c.name class_name FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND s.class_id = ?", input.studentId, input.classId); if (!student) throw new Error("该学生已被移除，请重新选择"); if (!normalize(input.content) && !input.images.length && !input.recordings.length) throw new Error("请填写文字、图片或录音"); const now = Date.now(); await db.runAsync("INSERT INTO student_records (id, class_id, student_id, student_name_snapshot, student_number_snapshot, class_name_snapshot, record_date, content, images_json, recordings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", id(), input.classId, input.studentId, student.name, student.student_number, student.class_name, input.recordDate, normalize(input.content), JSON.stringify(input.images), JSON.stringify(input.recordings), now, now); }
export async function queryStudentRecords(input: { classId: string; studentId?: string; from?: string; to?: string }) { const db = await getDatabase(); const clauses = ["class_id = ?"]; const args: string[] = [input.classId]; if (input.studentId) { clauses.push("student_id = ?"); args.push(input.studentId); } if (input.from) { clauses.push("record_date >= ?"); args.push(input.from); } if (input.to) { clauses.push("record_date <= ?"); args.push(input.to); } return (await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM student_records WHERE ${clauses.join(" AND ")} ORDER BY record_date DESC, created_at DESC, id DESC`, ...args)).map(recordRow); }
export async function getStudentRecord(recordId: string) { const db = await getDatabase(); const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM student_records WHERE id = ?", recordId); return row ? recordRow(row) : null; }
export async function deleteStudentRecord(recordId: string) { const db = await getDatabase(); await db.runAsync("DELETE FROM student_records WHERE id = ?", recordId); }

const classThreeLessons = [
  ["数学", "语文", "语文", "音乐", "语文"],
  ["语文", "数学", "音乐", "英语", "数学"],
  ["科学", "美术", "语文", "语文", "英语"],
  ["体育", "美术", "数学", "美术", "体育"],
  ["道法", "体育", "英语", "信息", "科学"],
  ["班会", "综合", "体育", "书法", "道法"],
  ["姜慧文", "郭朱甜甜", "黄娜", "黄娜", "姜慧文"],
];

const jiangHuiwenLessons = [
  ["六3 数学", "六1 数学", "", "", "六1 数学"],
  ["六1 数学", "六3 数学", "", "", "六3 数学"],
  ["", "", "六1 数学", "", ""],
  ["", "", "六3 数学", "", ""],
  ["六3 道法", "", "六1 综合", "", ""],
  ["班会", "六3 综合", "", "", "六3 道法"],
  ["六3", "六1", "六1", "", "六3"],
];

async function seedLessons(timetableId: string, lessons: string[][]) {
  for (const [periodIndex, week] of lessons.entries()) {
    for (const [dayIndex, subject] of week.entries()) {
      if (subject) await saveLesson({ timetableId, weekday: dayIndex + 1, period: periodIndex + 1, subject });
    }
  }
}

/** Imports the two supplied timetables once, without replacing user-created lessons. */
export async function ensureInitialSchoolData() {
  const db = await getDatabase();
  const done = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", "initial_school_data_v1");
  if (done) return;

  let classThree = (await listClasses()).find((item) => item.name === "三班");
  if (!classThree) classThree = await createClass("三班");

  const classTimetable = await getLessons("class", classThree.id);
  if (classTimetable.timetableId && classTimetable.lessons.length === 0) await seedLessons(classTimetable.timetableId, classThreeLessons);

  const teacherTimetable = await getLessons("teacher");
  if (teacherTimetable.timetableId && teacherTimetable.lessons.length === 0) await seedLessons(teacherTimetable.timetableId, jiangHuiwenLessons);

  await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)", "initial_school_data_v1", "complete", Date.now());
}
