const PROTOCOL_VERSION = 1;
const MAX_CONTENT_LENGTH = 200;
const MAX_BODY_BYTES = 16 * 1024;

const MESSAGE_STATUSES = Object.freeze({
  RECEIVED: "received",
  DISPLAYING: "displaying",
  SPEAKING: "speaking",
  PLAYED: "played",
  FAILED: "failed",
  EXPIRED: "expired",
  DUPLICATE: "duplicate",
});

function validateMessage(input, now = Date.now()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "消息格式不正确" };
  }

  const messageId = typeof input.messageId === "string" ? input.messageId.trim() : "";
  const classId = typeof input.classId === "string" ? input.classId.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  const createdAt = Number(input.createdAt);
  const expiresAt = Number(input.expiresAt);

  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(messageId)) {
    return { ok: false, error: "messageId 无效" };
  }
  if (!classId || classId.length > 80) {
    return { ok: false, error: "classId 无效" };
  }
  if (!content) return { ok: false, error: "通知内容不能为空" };
  if (content.length > MAX_CONTENT_LENGTH) {
    return { ok: false, error: `通知内容不能超过 ${MAX_CONTENT_LENGTH} 个字符` };
  }
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) {
    return { ok: false, error: "消息时间无效" };
  }
  if (expiresAt <= now) return { ok: false, expired: true, error: "消息已过期" };
  if (createdAt > now + 60_000) return { ok: false, error: "手机时间与电脑时间不一致" };

  return {
    ok: true,
    value: { protocolVersion: PROTOCOL_VERSION, messageId, classId, content, createdAt, expiresAt },
  };
}

module.exports = { MAX_BODY_BYTES, MAX_CONTENT_LENGTH, MESSAGE_STATUSES, PROTOCOL_VERSION, validateMessage };
