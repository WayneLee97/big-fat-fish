const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ClassroomApiServer } = require("../src/api-server");
const { MessageStore } = require("../src/message-store");
const { SpeechEngine } = require("../src/speech-engine");

async function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bff-classroom-"));
  const store = new MessageStore(path.join(directory, "messages.json"));
  const accepted = [];
  let accessToken = "test-token";
  let boundClass = null;
  const server = new ClassroomApiServer({ store, accessToken: () => accessToken, pairingCode: () => "123456", host: "127.0.0.1", port: 0, deviceInfo: () => ({ deviceId: "device-1", classId: boundClass?.classId ?? null }), onAccepted: (message) => accepted.push(message), onPair: ({ classId, className }) => { boundClass = { classId, className }; accessToken = "paired-token"; return { deviceId: "device-1", classId, className, accessToken }; } });
  const port = await server.start();
  return { accepted, baseUrl: `http://127.0.0.1:${port}`, server, store };
}

function validMessage(overrides = {}) {
  return { messageId: "message_12345678", classId: "class-1", content: "请李明同学下课后到办公室", createdAt: Date.now(), expiresAt: Date.now() + 120_000, ...overrides };
}

test("health endpoint is available without a token", async (t) => {
  const setup = await fixture(); t.after(() => setup.server.stop());
  const response = await fetch(`${setup.baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deviceId, "device-1");
});

test("accepts a valid message and rejects duplicate playback", async (t) => {
  const setup = await fixture(); t.after(() => setup.server.stop());
  const options = { method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" }, body: JSON.stringify(validMessage()) };
  const first = await fetch(`${setup.baseUrl}/api/v1/messages`, options);
  assert.equal(first.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(setup.accepted.length, 1);
  const second = await fetch(`${setup.baseUrl}/api/v1/messages`, options);
  assert.equal((await second.json()).status, "duplicate");
  assert.equal(setup.accepted.length, 1);
});

test("rejects missing credentials and expired messages", async (t) => {
  const setup = await fixture(); t.after(() => setup.server.stop());
  const unauthorized = await fetch(`${setup.baseUrl}/api/v1/messages`, { method: "POST", body: JSON.stringify(validMessage()) });
  assert.equal(unauthorized.status, 401);
  const expired = validMessage({ createdAt: Date.now() - 180_000, expiresAt: Date.now() - 60_000 });
  const response = await fetch(`${setup.baseUrl}/api/v1/messages`, { method: "POST", headers: { Authorization: "Bearer test-token" }, body: JSON.stringify(expired) });
  assert.equal(response.status, 410);
});

test("pairs a class, rotates credentials, and rejects another class", async (t) => {
  const setup = await fixture(); t.after(() => setup.server.stop());
  const pairedResponse = await fetch(`${setup.baseUrl}/api/v1/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pairingCode: "123456", classId: "class-1", className: "三班" }) });
  assert.equal(pairedResponse.status, 200);
  assert.equal((await pairedResponse.json()).accessToken, "paired-token");
  const oldToken = await fetch(`${setup.baseUrl}/api/v1/messages`, { headers: { Authorization: "Bearer test-token" } });
  assert.equal(oldToken.status, 401);
  const wrongClass = await fetch(`${setup.baseUrl}/api/v1/messages`, { method: "POST", headers: { Authorization: "Bearer paired-token", "Content-Type": "application/json" }, body: JSON.stringify(validMessage({ classId: "class-2" })) });
  assert.equal(wrongClass.status, 409);
});

test("speech queue expires stale messages instead of playing them", async () => {
  const engine = new SpeechEngine({ simulate: true });
  const expired = new Promise((resolve) => engine.once("expired", resolve));
  let spoke = false;
  engine.once("speaking", () => { spoke = true; });
  engine.enqueue({ messageId: "expired_12345678", content: "旧消息", expiresAt: Date.now() - 1 });
  await expired;
  assert.equal(spoke, false);
});
