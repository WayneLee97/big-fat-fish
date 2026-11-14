const { constants } = require("node:fs");
const fs = require("node:fs/promises");
const http = require("node:http");

function checkLocalService(port, timeoutMs = 3_000) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: "127.0.0.1", port, path: "/api/v1/health", timeout: timeoutMs }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (response.statusCode !== 200 || body.ok !== true) throw new Error(`健康检查返回 ${response.statusCode}`);
          resolve(body);
        } catch (error) { reject(error); }
      });
    });
    request.once("timeout", () => request.destroy(new Error("本机服务检查超时")));
    request.once("error", reject);
  });
}

async function runSystemDiagnostics({
  port,
  addresses,
  speech,
  userDataPath,
  isPackaged,
  loginItemSettings,
  healthCheck = checkLocalService,
  storageCheck = (directory) => fs.access(directory, constants.R_OK | constants.W_OK),
}) {
  const checks = [];

  try {
    await healthCheck(port);
    checks.push({ id: "service", status: "passed", title: "消息服务", detail: `本机端口 ${port} 正常监听` });
  } catch (error) {
    checks.push({ id: "service", status: "failed", title: "消息服务", detail: error.message || "本机服务不可用" });
  }

  checks.push(addresses.length
    ? { id: "network", status: "passed", title: "局域网地址", detail: addresses.join("、") }
    : { id: "network", status: "failed", title: "局域网地址", detail: "没有找到可供手机连接的 IPv4 地址" });

  try {
    await storageCheck(userDataPath);
    checks.push({ id: "storage", status: "passed", title: "数据目录", detail: "配置和消息记录可以正常读写" });
  } catch (error) {
    checks.push({ id: "storage", status: "failed", title: "数据目录", detail: error.message || "数据目录无法读写" });
  }

  const speechResult = await speech.diagnose();
  checks.push(speechResult.available
    ? { id: "speech", status: "passed", title: "离线文字转语音", detail: `已验证非静音音频；语音：${speechResult.voices.join("、")}；时长 ${speechResult.durationMs}ms；峰值 ${speechResult.peak}；RMS ${speechResult.rms}` }
    : { id: "speech", status: "failed", title: "离线语音引擎", detail: speechResult.error || "离线语音模型不可用" });

  if (!isPackaged) checks.push({ id: "startup", status: "warning", title: "登录自启动", detail: "开发模式不检查登录自启动" });
  else if (loginItemSettings?.openAtLogin) checks.push({ id: "startup", status: "passed", title: "登录自启动", detail: "当前用户登录 Windows 后会自动运行" });
  else checks.push({ id: "startup", status: "warning", title: "登录自启动", detail: "尚未检测到登录自启动，请重启客户端后再次检查" });

  return {
    checkedAt: Date.now(),
    ok: checks.every((check) => check.status !== "failed"),
    checks,
  };
}

module.exports = { checkLocalService, runSystemDiagnostics };
