import type { TimetableLesson } from '../../data/school';

export function validateLessonTimes(times: string[]) {
  if (times.length !== 8 || times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    throw new Error('请为全部 8 节课填写有效的上课时间（HH:mm）');
  }
  if (times.some((time, index) => index > 0 && time <= times[index - 1])) {
    throw new Error('各节上课时间需按先后顺序排列');
  }
  return times;
}

export function lessonReminderPlan(timetableId: string, lessons: TimetableLesson[], times: string[], now = new Date()) {
  validateLessonTimes(times);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  return lessons.flatMap(lesson => {
    if (lesson.adjustmentType !== 'temporary') return [];
    const [hour, minute] = times[lesson.period - 1].split(':').map(Number);
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + lesson.weekday - 1, hour, minute);
    const eventAt = date.getTime();
    if (eventAt <= now.getTime() || (lesson.effectiveFrom != null && eventAt < lesson.effectiveFrom)
      || (lesson.effectiveUntil != null && eventAt >= lesson.effectiveUntil)) return [];
    const eventDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return [{
      id: `lesson-reminder:${timetableId}:${eventDate}:${lesson.period}`,
      content: `临时调课：${lesson.subject} · 第${lesson.period}节 ${times[lesson.period - 1]}${lesson.room ? ` · ${lesson.room}` : ''}（课前10分钟提醒）`,
      eventAt, eventDate, remindAt: eventAt - 10 * 60_000,
    }];
  });
}
