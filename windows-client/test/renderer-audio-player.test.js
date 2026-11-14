const assert = require("node:assert/strict");
const test = require("node:test");

const { RendererAudioPlayer } = require("../src/renderer-audio-player");

test("renderer audio player waits for Chromium playback completion", async () => {
  const sent = [];
  const webContents = {
    isDestroyed: () => false,
    isLoadingMainFrame: () => false,
    send: (channel, payload) => sent.push({ channel, payload }),
  };
  const player = new RendererAudioPlayer(webContents, 1_000);
  const completed = player.play("UklGRg==");

  assert.equal(sent[0].channel, "classroom:play-audio");
  assert.equal(player.complete({ requestId: sent[0].payload.requestId, ok: true }), true);
  await completed;
  assert.equal(player.pending.size, 0);
});

test("renderer audio player returns Chromium playback errors", async () => {
  let request;
  const webContents = {
    isDestroyed: () => false,
    isLoadingMainFrame: () => false,
    send: (_channel, payload) => { request = payload; },
  };
  const player = new RendererAudioPlayer(webContents, 1_000);
  const completed = player.play("UklGRg==");
  player.complete({ requestId: request.requestId, ok: false, error: "没有音频输出设备" });
  await assert.rejects(completed, /没有音频输出设备/);
});
