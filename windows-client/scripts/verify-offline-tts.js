const fs = require("node:fs");
const path = require("node:path");
const { OfflineTtsSynthesizer } = require("../src/offline-tts");

async function main() {
  const modelDir = path.join(__dirname, "..", "resources", "tts", "vits-melo-tts-zh_en");
  const outputPath = path.join(process.cwd(), "offline-tts-verification.wav");
  const synthesizer = new OfflineTtsSynthesizer({ modelDir });
  try {
    const result = await synthesizer.synthesize("大肥鱼教室呼叫，离线文字转语音验证成功。");
    fs.writeFileSync(outputPath, Buffer.from(result.audioBase64, "base64"));
    console.log(JSON.stringify({
      ok: true,
      engine: result.engine,
      voice: result.voice,
      model: result.model,
      loadMs: result.loadMs,
      synthesisMs: result.synthesisMs,
      durationMs: result.durationMs,
      peak: result.peak,
      rms: result.rms,
      outputPath,
    }, null, 2));
  } finally {
    await synthesizer.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
