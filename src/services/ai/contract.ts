export interface Suggestion {
  title: string;
  date: string | null;
  time: string | null;
  evidence: string;
  relevance: string;
  uncertainty: string;
}
export interface Analysis { summary: string; items: Suggestion[] }
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain', md: 'text/markdown',
};
export const analysisSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'items'],
  properties: {
    summary: { type: 'string' },
    items: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['title', 'date', 'time', 'evidence', 'relevance', 'uncertainty'],
      properties: {
        title: { type: 'string' }, date: { type: ['string', 'null'] }, time: { type: ['string', 'null'] },
        evidence: { type: 'string' }, relevance: { type: 'string' }, uncertainty: { type: 'string' },
      },
    } },
  },
};
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function parseAnalysis(value: unknown): Analysis {
  if (!value || typeof value !== 'object') throw new Error('AI 返回了无效结果，请重试');
  const result = value as Analysis;
  if (typeof result.summary !== 'string' || result.summary.length > 5000 || !Array.isArray(result.items) || result.items.length > 50) throw new Error('AI 返回的事项格式或数量不正确');
  for (const item of result.items) {
    if (!item || ['title', 'evidence', 'relevance', 'uncertainty'].some(key => typeof item[key as keyof Suggestion] !== 'string' || (item[key as keyof Suggestion]?.length ?? 0) > 5000) || !item.title.trim() || !item.evidence.trim() || (item.date !== null && !validDate(item.date)) || (item.time !== null && !validTime(item.time))) throw new Error('AI 返回的事项缺少依据或日期格式不正确，请重试');
  }
  return result;
}
export function localTimestamp(date: string, time: string): number {
  if (!validDate(date) || !validTime(time)) throw new Error('请填写有效日期 YYYY-MM-DD 和时间 HH:mm');
  const result = new Date(`${date}T${time}:00`);
  if (result.getHours() !== Number(time.slice(0, 2)) || result.getMinutes() !== Number(time.slice(3))) throw new Error('该时间在当前时区不存在，请重新选择');
  return result.getTime();
}
