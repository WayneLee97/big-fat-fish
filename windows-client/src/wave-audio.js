function encodeWavePcm16(samples, sampleRate) {
  if (!samples?.length || !Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("离线语音引擎没有返回有效音频采样");
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(sample < 0 ? sample * 32768 : sample * 32767), 44 + index * 2);
  }
  return buffer;
}

function analyzeWavePcm16(buffer) {
  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") throw new Error("语音引擎返回的不是有效 WAV 文件");
  let offset = 12;
  let format;
  let data;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + length > buffer.length) break;
    if (id === "fmt " && length >= 16) format = {
      audioFormat: buffer.readUInt16LE(start),
      channels: buffer.readUInt16LE(start + 2),
      sampleRate: buffer.readUInt32LE(start + 4),
      bitsPerSample: buffer.readUInt16LE(start + 14),
    };
    if (id === "data") data = buffer.subarray(start, start + length);
    offset = start + length + (length % 2);
  }
  if (!format || !data || format.audioFormat !== 1 || format.bitsPerSample !== 16) throw new Error("语音 WAV 不是受支持的 16 位 PCM 格式");
  let peak = 0;
  let sumSquares = 0;
  const samples = Math.floor(data.length / 2);
  for (let index = 0; index < samples; index += 1) {
    const sample = data.readInt16LE(index * 2);
    const absolute = Math.abs(sample);
    if (absolute > peak) peak = absolute;
    sumSquares += sample * sample;
  }
  const rms = samples ? Math.sqrt(sumSquares / samples) : 0;
  const durationMs = samples && format.sampleRate && format.channels ? Math.round(samples / format.sampleRate / format.channels * 1000) : 0;
  return { ...format, samples, peak, rms: Math.round(rms), durationMs, audioBytes: buffer.length };
}

module.exports = { analyzeWavePcm16, encodeWavePcm16 };
