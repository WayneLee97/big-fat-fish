const http = require("node:http");
const { MAX_BODY_BYTES, MESSAGE_STATUSES, PROTOCOL_VERSION, validateMessage } = require("./protocol");

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("请求内容过大"), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON 格式不正确"), { statusCode: 400 });
  }
}

class ClassroomApiServer {
  constructor({ store, accessToken, pairingCode, deviceInfo, onAccepted, onPair, host = "0.0.0.0", port = 32145 }) {
    this.store = store;
    this.accessToken = accessToken;
    this.pairingCode = pairingCode;
    this.deviceInfo = deviceInfo;
    this.onAccepted = onAccepted;
    this.onPair = onPair;
    this.host = host;
    this.port = port;
    this.server = http.createServer((request, response) => void this.route(request, response));
  }

  isAuthorized(request) {
    const header = request.headers.authorization ?? "";
    const token = typeof this.accessToken === "function" ? this.accessToken() : this.accessToken;
    return header === `Bearer ${token}`;
  }

  async route(request, response) {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "GET" && url.pathname === "/api/v1/health") {
      return sendJson(response, 200, { ok: true, protocolVersion: PROTOCOL_VERSION, ...this.deviceInfo() });
    }
    if (request.method === "POST" && url.pathname === "/api/v1/pair") {
      try {
        const input = await readJson(request);
        const expectedCode = typeof this.pairingCode === "function" ? this.pairingCode() : this.pairingCode;
        if (!input || String(input.pairingCode ?? "").trim() !== expectedCode) return sendJson(response, 401, { ok: false, error: "配对码不正确或已失效" });
        const classId = typeof input.classId === "string" ? input.classId.trim() : "";
        const className = typeof input.className === "string" ? input.className.trim() : "";
        if (!classId || classId.length > 80 || !className || className.length > 40) return sendJson(response, 400, { ok: false, error: "班级信息无效" });
        const paired = await this.onPair({ classId, className });
        return sendJson(response, 200, { ok: true, protocolVersion: PROTOCOL_VERSION, ...paired });
      } catch (error) {
        return sendJson(response, error.statusCode ?? 500, { ok: false, error: error.message ?? "配对失败" });
      }
    }
    if (!this.isAuthorized(request)) return sendJson(response, 401, { ok: false, error: "设备访问码不正确" });

    if (request.method === "POST" && url.pathname === "/api/v1/messages") {
      try {
        const result = validateMessage(await readJson(request));
        if (!result.ok) {
          return sendJson(response, result.expired ? 410 : 400, { ok: false, status: result.expired ? MESSAGE_STATUSES.EXPIRED : MESSAGE_STATUSES.FAILED, error: result.error });
        }
        const boundClassId = this.deviceInfo().classId;
        if (boundClassId && result.value.classId !== boundClassId) return sendJson(response, 409, { ok: false, status: MESSAGE_STATUSES.FAILED, error: "这台电脑绑定的是其他班级" });
        const existing = this.store.get(result.value.messageId);
        if (existing) return sendJson(response, 200, { ok: true, status: MESSAGE_STATUSES.DUPLICATE, message: existing });

        const message = this.store.put({ ...result.value, status: MESSAGE_STATUSES.RECEIVED, errorCode: null, errorMessage: null });
        sendJson(response, 202, { ok: true, status: MESSAGE_STATUSES.RECEIVED, message });
        queueMicrotask(() => this.onAccepted(message));
        return;
      } catch (error) {
        return sendJson(response, error.statusCode ?? 500, { ok: false, error: error.message ?? "接收消息失败" });
      }
    }

    const statusMatch = url.pathname.match(/^\/api\/v1\/messages\/([a-zA-Z0-9_-]{8,80})$/);
    if (request.method === "GET" && statusMatch) {
      const message = this.store.get(statusMatch[1]);
      return message ? sendJson(response, 200, { ok: true, message }) : sendJson(response, 404, { ok: false, error: "没有找到这条消息" });
    }
    if (request.method === "GET" && url.pathname === "/api/v1/messages") {
      return sendJson(response, 200, { ok: true, messages: this.store.list().slice(0, 20) });
    }
    return sendJson(response, 404, { ok: false, error: "接口不存在" });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, () => {
        this.port = this.server.address().port;
        resolve(this.port);
      });
    });
  }

  stop() {
    return new Promise((resolve) => this.server.close(resolve));
  }
}

module.exports = { ClassroomApiServer };
