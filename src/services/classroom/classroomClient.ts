import * as SecureStore from "expo-secure-store";

import { getDatabase } from "@/data/database";

export const CLASSROOM_PROTOCOL_VERSION = 1;
export const CLASSROOM_MESSAGE_MAX_LENGTH = 200;

export type ClassroomConnection = {
  baseUrl: string;
  accessToken: string;
  deviceId?: string;
  deviceName?: string;
};

export type ClassroomMessageStatus =
  | "received"
  | "displaying"
  | "speaking"
  | "played"
  | "failed"
  | "expired"
  | "duplicate";

export type ClassroomMessage = {
  messageId: string;
  classId: string;
  content: string;
  createdAt: number;
  expiresAt: number;
  status: ClassroomMessageStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  updatedAt: number;
};

type HealthResponse = {
  ok: boolean;
  protocolVersion: number;
  deviceId: string;
  deviceName: string;
  className: string;
};

type PairResponse = HealthResponse & {
  classId: string;
  className: string;
  accessToken: string;
};

type ClassroomPairingQr = {
  type: "big-fat-fish-classroom";
  protocolVersion: number;
  deviceId: string;
  deviceName: string;
  addresses: string[];
  pairingCode: string;
};

const TERMINAL_STATUSES = new Set<ClassroomMessageStatus>(["played", "failed", "expired"]);
const connectionKey = (classId: string) => `classroom_connection_${classId}`;
const tokenKey = (classId: string) => `classroom-token-${classId.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

export function normalizeClassroomUrl(value: string) {
  const candidate = value.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(candidate) ? candidate : `http://${candidate}`;
  let parsed: URL;
  try { parsed = new URL(withScheme); } catch { throw new Error("请输入有效的电脑地址，例如 192.168.1.20:32145"); }
  if (!parsed.hostname || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) throw new Error("电脑地址格式不正确");
  return parsed.origin;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("连接超时，请检查电脑客户端和局域网");
    throw new Error("无法连接教室电脑，请检查地址、网络和客户端状态");
  } finally {
    clearTimeout(timer);
  }
}

async function responseJson<T>(response: Response) {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`);
  return body;
}

export async function testClassroomConnection(baseUrl: string, accessToken?: string) {
  const normalized = normalizeClassroomUrl(baseUrl);
  const response = await fetchWithTimeout(`${normalized}/api/v1/health`);
  const health = await responseJson<HealthResponse>(response);
  if (health.protocolVersion !== CLASSROOM_PROTOCOL_VERSION) throw new Error("手机与电脑客户端版本不兼容");
  if (accessToken) {
    const authResponse = await fetchWithTimeout(`${normalized}/api/v1/messages`, { headers: headers(accessToken) });
    await responseJson<{ ok: boolean }>(authResponse);
  }
  return { ...health, baseUrl: normalized };
}

export async function pairClassroomDevice(baseUrl: string, pairingCode: string, schoolClass: { id: string; name: string }) {
  const normalized = normalizeClassroomUrl(baseUrl);
  if (!/^\d{6}$/.test(pairingCode.trim())) throw new Error("请输入 Windows 客户端显示的六位配对码");
  const response = await fetchWithTimeout(`${normalized}/api/v1/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode: pairingCode.trim(), classId: schoolClass.id, className: schoolClass.name }),
  });
  const paired = await responseJson<PairResponse>(response);
  if (paired.protocolVersion !== CLASSROOM_PROTOCOL_VERSION) throw new Error("手机与电脑客户端版本不兼容");
  const connection = { baseUrl: normalized, accessToken: paired.accessToken, deviceId: paired.deviceId, deviceName: paired.deviceName };
  await saveClassroomConnection(schoolClass.id, connection);
  return connection;
}

export function parseClassroomPairingQr(data: string): ClassroomPairingQr {
  let payload: unknown;
  try { payload = JSON.parse(data); } catch { throw new Error("这不是大肥鱼教室客户端的二维码"); }
  if (!payload || typeof payload !== "object") throw new Error("配对二维码内容无效");
  const candidate = payload as Partial<ClassroomPairingQr>;
  if (candidate.type !== "big-fat-fish-classroom" || candidate.protocolVersion !== CLASSROOM_PROTOCOL_VERSION) throw new Error("配对二维码版本不兼容");
  if (!candidate.deviceId || !candidate.deviceName || !Array.isArray(candidate.addresses) || !/^\d{6}$/.test(candidate.pairingCode ?? "")) throw new Error("配对二维码缺少设备信息");
  const addresses = [...new Set(candidate.addresses.map((address) => normalizeClassroomUrl(String(address))))];
  if (!addresses.length) throw new Error("电脑没有可用的局域网地址");
  return { ...candidate, addresses } as ClassroomPairingQr;
}

export async function pairClassroomDeviceFromQr(data: string, schoolClass: { id: string; name: string }) {
  const payload = parseClassroomPairingQr(data);
  const attempts = await Promise.allSettled(payload.addresses.map(async (address) => {
    const health = await testClassroomConnection(address);
    if (health.deviceId !== payload.deviceId) throw new Error("设备标识不匹配");
    return health.baseUrl;
  }));
  const reachable = attempts.find((attempt): attempt is PromiseFulfilledResult<string> => attempt.status === "fulfilled");
  if (!reachable) throw new Error("无法连接二维码中的教室电脑，请确认手机与电脑在同一局域网");
  return pairClassroomDevice(reachable.value, payload.pairingCode, schoolClass);
}

export async function saveClassroomConnection(classId: string, connection: ClassroomConnection) {
  const database = await getDatabase();
  const value = JSON.stringify({ baseUrl: normalizeClassroomUrl(connection.baseUrl), deviceId: connection.deviceId, deviceName: connection.deviceName });
  await database.runAsync("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)", connectionKey(classId), value, Date.now());
  await SecureStore.setItemAsync(tokenKey(classId), connection.accessToken.trim());
}

export async function loadClassroomConnection(classId: string): Promise<ClassroomConnection | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", connectionKey(classId));
  const accessToken = await SecureStore.getItemAsync(tokenKey(classId));
  if (!row || !accessToken) return null;
  try { return { ...JSON.parse(row.value), accessToken }; } catch { return null; }
}

export async function clearClassroomConnection(classId: string) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM app_settings WHERE key = ?", connectionKey(classId));
  await SecureStore.deleteItemAsync(tokenKey(classId));
}

function messageId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function headers(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

export async function sendClassroomMessage(connection: ClassroomConnection, classId: string, content: string) {
  const cleanContent = content.trim();
  if (!cleanContent) throw new Error("请输入要播报的文字");
  if (cleanContent.length > CLASSROOM_MESSAGE_MAX_LENGTH) throw new Error(`通知不能超过 ${CLASSROOM_MESSAGE_MAX_LENGTH} 个字符`);
  const baseUrl = normalizeClassroomUrl(connection.baseUrl);
  const createdAt = Date.now();
  const payload = { protocolVersion: CLASSROOM_PROTOCOL_VERSION, messageId: messageId(), classId, content: cleanContent, createdAt, expiresAt: createdAt + 120_000 };
  const response = await fetchWithTimeout(`${baseUrl}/api/v1/messages`, { method: "POST", headers: headers(connection.accessToken), body: JSON.stringify(payload) });
  const result = await responseJson<{ ok: boolean; message: ClassroomMessage }>(response);
  return result.message;
}

export async function getClassroomMessage(connection: ClassroomConnection, messageIdValue: string) {
  const baseUrl = normalizeClassroomUrl(connection.baseUrl);
  const response = await fetchWithTimeout(`${baseUrl}/api/v1/messages/${encodeURIComponent(messageIdValue)}`, { headers: headers(connection.accessToken) });
  return (await responseJson<{ ok: boolean; message: ClassroomMessage }>(response)).message;
}

export async function waitForClassroomMessage(
  connection: ClassroomConnection,
  initial: ClassroomMessage,
  onUpdate: (message: ClassroomMessage) => void,
  timeoutMs = 30_000,
) {
  const startedAt = Date.now();
  let current = initial;
  onUpdate(current);
  while (!TERMINAL_STATUSES.has(current.status) && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    current = await getClassroomMessage(connection, current.messageId);
    onUpdate(current);
  }
  return current;
}
