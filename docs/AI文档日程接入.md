# AI 文档日程助手（DeepSeek）

首页或周日历右上角进入「AI 文档助手」。当前流程为：拍照、从相册选择图片、导入文件（Excel XLSX、Word DOC/DOCX、PDF、TXT、MD）或粘贴通知 → 填写身份、班级和职责 → 允许发送给 DeepSeek → 查看摘要、原文依据和相关原因 → 修改日期时间并勾选 → 确认加入 APP 日程。文件和单张照片最大 10 MB，一次最多分析 5 张照片。

这是个人自用的 DeepSeek 直连模式，不需要部署服务器。其他 APP 的文件可先保存到系统「文件」，再在这里导入。当前尚未实现 iOS/Android 系统分享扩展或系统日历同步。

## 首次使用

1. 在 DeepSeek 开放平台创建 API Key，并为账户设置合适的余额或消费控制。
2. 打开「AI 文档助手」，输入 DeepSeek API Key。Key 默认保存在 iOS Keychain 或 Android Keystore 中，不写入 SQLite、源码、日志或 `EXPO_PUBLIC` 环境变量。
3. 默认模型是官方当前推荐的 `deepseek-flash`，也是当前文件输入所需模型。仅分析粘贴文本时可填写账户中的其他兼容模型，例如 `deepseek-v4-pro`。
4. 填写自己的身份和职责，拍摄通知、选择相册图片、导入文档或粘贴通知，勾选同意后开始分析。
5. 安装新增原生组件后需要重建 development build，例如运行 `npx expo run:ios`。

如果不希望持久保存 Key，可以关闭「在此设备安全保存 API Key」。页面中的「清除设备中的 API Key」会立即删除安全存储中的凭据。iOS Keychain 数据可能在卸载后、使用相同 Bundle ID 重装时继续存在；卸载前可先使用清除按钮。

## 文件与隐私

- Word（DOC、DOCX）、PDF 和照片使用 DeepSeek Files API 的 `text_recognition` 解析；Excel XLSX、TXT、MD 使用 `user_data` 上传。DeepSeek 会将 XLSX 转换成 Markdown 供模型读取。照片会先在设备上转为 JPEG，长边超过 4096 像素时会等比例缩小，以兼容 DeepSeek 图片输入并控制上传体积。
- 上传时设置一小时自动过期。分析结束后 APP 会主动请求删除远程文件；即使删除请求失败，自动过期仍会清理文件。
- DeepSeek 的文档解析可能单独按页计费，模型分析还会消耗输入和输出 Token。具体以 DeepSeek 开放平台账单为准。
- 原始文件保留在系统文件选择器的本地缓存中，由操作系统管理；处理后的 OCR 图片写入系统缓存目录，移除图片时会尝试立即删除。原文文件、照片和粘贴全文不写入业务数据库。
- 身份信息、模型名称和分析草稿（包括原文短摘录）保存在本地 SQLite；DeepSeek API Key 只进入系统安全存储。

## 分析和确认边界

- 用户打开同意开关并点击分析后，照片、文档、粘贴文本和身份信息从设备直接发送至 DeepSeek。
- DeepSeek JSON Output 保证返回合法 JSON，APP 仍会再次校验事项数量、必填字段、日期和时间。
- 所有建议默认不选中。日期或时间不明确时要求用户补全；按设备时区入库，不自动猜测年份、通知发布时间或循环周期。
- 用户确认后通过单个 SQLite 事务写入；同标题、同时间的有效日程自动跳过。日程写入后再设置本地提醒，提醒权限拒绝或设置失败不会造成重复日程。
- 模型仅返回结构化建议，没有直接写日程或执行其他操作的工具。

## 验证

- `npx tsc --noEmit`
- `node --test src/services/ai/contract.test.mjs`
- `npx expo export --platform ios --output-dir /tmp/big-fat-fish-deepseek-export`
- 真机验收：输入/清除 Key、重启后恢复 Key、拍照、相册多选、图片预览与移除、导入 XLSX/DOC/DOCX/PDF/TXT/MD、远程文件删除、无相关事项、模糊日期补全、修改并勾选、二次导入去重、拒绝相机/通知权限、断网、余额不足和限流提示。

自动验证不会调用计费模型。真实文档分析需要在设备中输入自己的 DeepSeek API Key。

## 文档依据

- Expo 57 SecureStore：https://docs.expo.dev/versions/v57.0.0/sdk/securestore.md
- Expo 57 DocumentPicker：https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/
- Expo 57 FileSystem：https://docs.expo.dev/versions/v57.0.0/sdk/filesystem.md
- Expo 57 ImagePicker：https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
- Expo 57 ImageManipulator：https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/
- DeepSeek 快速开始：https://api-docs.deepseek.com/guides/codex
- DeepSeek Files API：https://api-docs.deepseek.com/guides/files_api/
- DeepSeek 文件解析：https://api-docs.deepseek.com/guides/document_parsing/
- DeepSeek 图片理解：https://api-docs.deepseek.com/guides/vision/
- DeepSeek OCR：https://api-docs.deepseek.com/guides/ocr/
- DeepSeek JSON Output：https://api-docs.deepseek.com/guides/json_mode/
