# 大肥鱼教室呼叫 Windows 客户端

客户端提供局域网设备广播、二维码配对、消息接收、通知展示、离线中文语音播报、状态查询和重复消息保护。

## 本地开发

```powershell
cd windows-client
npm install
npm start
```

客户端默认监听 `32145` 端口。首次启动会生成设备 ID，界面显示六位一次性配对码。手机成功绑定班级后，双方保存新的随机访问令牌。Windows 防火墙首次询问时，需要允许专用网络访问。

客户端同时广播 `_bigfatfish._tcp` 局域网服务。大肥鱼开发构建能够自动发现电脑，并在 DHCP 地址变化后按设备 ID 更新连接地址；不支持原生扩展的 Expo Go 仍可使用二维码或手工地址。

客户端首页的“运行系统自检”会检查消息服务端口、局域网 IPv4 地址、数据目录、离线语音模型和登录自启动。全部通过后，再点击“测试离线语音”确认电脑扬声器实际出声。

语音播报使用随安装包提供的 `sherpa-onnx` 和 `vits-melo-tts-zh_en-int8` 中英文模型。模型在独立工作线程中把文字同步合成为 44.1kHz 单声道 PCM，再由客户端编码为 WAV。独立线程可以避免阻塞界面，也绕过 sherpa-onnx Windows 异步生成接口的 `TTS settlement failed` 问题。该流程不调用 Windows `System.Speech`、不需要安装 Windows 中文语音包，也不需要访问云端 TTS 服务。

生成的 WAV 会在播放前解析 16 位 PCM 数据，只有时长、峰值和 RMS 达到非静音标准时才交给 Electron 播放。手机端只有在音频验证通过且播放器结束后才会收到“播报完成”。相同文案会使用内存缓存，避免重复合成。

“测试扬声器”播放程序生成的纯音，用于确认扬声器和 Electron 音频通道。“测试离线语音”会完成真实的模型加载、文字转语音、波形验证和播放，结果显示合成耗时、音频时长、峰值、RMS 和输出设备。“运行系统自检”也会生成一段中文测试语音并验证波形。

运行测试不依赖 Electron：

```powershell
npm test
```

可以单独运行真实离线模型验收脚本：

```powershell
npm run verify:offline-tts
```

脚本会生成 `offline-tts-verification.wav`，并打印模型加载耗时、合成耗时、音频时长、峰值和 RMS。`npm test` 也会使用打包模型完成一次真实中文合成，不使用模拟语音。

## 生成 Windows 安装包

在 `windows-client` 目录执行：

```powershell
npm run build:win
```

构建结果位于 `release/大肥鱼教室呼叫-<版本>-安装程序.exe`。安装程序支持选择安装位置，并创建桌面和开始菜单快捷方式。客户端安装后首次启动时，请在 Windows 防火墙提示中允许“专用网络”访问；打包版本会注册为当前 Windows 用户登录后自动启动。

如只需要免安装目录用于调试，可执行：

```powershell
npm run pack:win
```

## 接口

- `GET /api/v1/health`：读取客户端可用状态。
- `POST /api/v1/pair`：使用六位配对码绑定班级并取得设备令牌。
- `POST /api/v1/messages`：发送一条文字消息，需要 `Authorization: Bearer <设备令牌>`。
- `GET /api/v1/messages/:messageId`：查询播报结果，需要设备访问码。
- `GET /api/v1/messages`：查看最近 20 条消息，需要设备访问码。

发送示例：

```json
{
  "messageId": "message_12345678",
  "classId": "class-1",
  "content": "请李明同学下课后到办公室",
  "createdAt": 1794651600000,
  "expiresAt": 1794651720000
}
```

离线模型和 WAV 校验可在 macOS、Linux 与 Windows 上运行；最终安装包仍需在教室 Windows 电脑上验证扬声器设备和实际播放效果。
