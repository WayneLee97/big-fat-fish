const fs = require("node:fs");
const path = require("node:path");

class MessageStore {
  constructor(filePath, limit = 100) {
    this.filePath = filePath;
    this.limit = limit;
    this.messages = new Map();
  }

  load() {
    try {
      const items = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (Array.isArray(items)) items.forEach((item) => this.messages.set(item.messageId, item));
    } catch (error) {
      if (error.code !== "ENOENT") console.error("读取消息记录失败", error);
    }
  }

  get(messageId) {
    return this.messages.get(messageId) ?? null;
  }

  list() {
    return [...this.messages.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  put(message) {
    const now = Date.now();
    const existing = this.messages.get(message.messageId);
    const next = { ...existing, ...message, updatedAt: now };
    this.messages.set(next.messageId, next);
    this.prune();
    this.persist();
    return next;
  }

  update(messageId, changes) {
    const existing = this.messages.get(messageId);
    if (!existing) return null;
    return this.put({ ...existing, ...changes, messageId });
  }

  prune() {
    const items = this.list();
    items.slice(this.limit).forEach((item) => this.messages.delete(item.messageId));
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(this.list(), null, 2), "utf8");
    fs.renameSync(temporaryPath, this.filePath);
  }
}

module.exports = { MessageStore };
