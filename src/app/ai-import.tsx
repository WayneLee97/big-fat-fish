import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { getDatabase } from '@/data/database';
import { analyzeDocument, clearDeepSeekApiKey, deleteLocalImage, loadDeepSeekApiKey, MAX_IMAGE_COUNT, pickDocument, pickImages, saveDeepSeekApiKey, takePhoto, type ImportedDocument, type ImportedImage } from '@/services/ai/client';
import { type Suggestion } from '@/services/ai/contract';
import { confirmSuggestions } from '@/services/ai/importTasks';
import { useAppDispatch } from '@/store/hooks';
import { loadTasks } from '@/store/tasks';

type DraftItem = Suggestion & { selected: boolean };
export default function AiImport() {
  const dispatch = useAppDispatch();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-flash');
  const [rememberKey, setRememberKey] = useState(true);
  const [profile, setProfile] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<ImportedDocument | null>(null);
  const [images, setImages] = useState<ImportedImage[]>([]);
  const [summary, setSummary] = useState('');
  const [source, setSource] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const persistQueue = useRef(Promise.resolve());
  useEffect(() => {
    void (async () => {
      try {
        const db = await getDatabase();
        const [row, storedApiKey] = await Promise.all([
          db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'ai-import'),
          loadDeepSeekApiKey(),
        ]);
        if (storedApiKey) setApiKey(storedApiKey);
        if (row) {
          const saved = JSON.parse(row.value);
          setProfile(saved.profile ?? '');
          setModel(typeof saved.model === 'string' && saved.model.startsWith('deepseek-') ? saved.model : 'deepseek-flash');
          // Drafts may contain unfinished user edits; validate dates only on confirmation.
          const drafts: Suggestion[] = Array.isArray(saved.items) ? saved.items.slice(0, 50).filter((item: Suggestion) => item && ['title', 'evidence', 'relevance', 'uncertainty'].every(key => typeof item[key as keyof Suggestion] === 'string') && (item.date === null || typeof item.date === 'string') && (item.time === null || typeof item.time === 'string')) : [];
          setSummary(typeof saved.summary === 'string' ? saved.summary : ''); setSource(saved.source ?? '');
          setItems(drafts.map(item => ({ ...item, selected: false })));
        }
      } catch { setMessage('未能恢复上次草稿，可以重新导入。'); }
      finally { setReady(true); }
    })();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const value = JSON.stringify({ model, profile, summary, source, items });
    persistQueue.current = persistQueue.current.catch(() => {}).then(async () => {
      const db = await getDatabase();
      await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', 'ai-import', value, Date.now());
    }).catch(() => { setMessage('草稿未保存，退出前请完成确认。'); });
  }, [ready, model, profile, summary, source, items]);
  async function run(label: string, action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setMessage('');
    try { await action(); } catch (error) { Alert.alert('操作未完成', error instanceof Error ? error.message : '请稍后重试'); }
    finally { lock.current = false; setBusy(''); }
  }
  async function updateRememberKey(value: boolean) {
    setRememberKey(value);
    if (value) return;
    try {
      await clearDeepSeekApiKey();
      setMessage('已停止持久保存；当前 Key 只保留在本页面内存中。');
    } catch {
      setRememberKey(true);
      Alert.alert('无法清除 API Key', '请使用下方清除按钮重试。');
    }
  }
  function edit(index: number, patch: Partial<DraftItem>) { setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function removeImage(index: number) {
    setImages(current => {
      const image = current[index];
      if (image) deleteLocalImage(image);
      return current.filter((_, i) => i !== index);
    });
    setConsent(false);
  }
  function describeSource() {
    const parts: string[] = [];
    if (file) parts.push(file.name);
    if (images.length) parts.push(`${images.length} 张照片`);
    if (text.trim()) parts.push('粘贴的通知');
    return parts.join(' + ');
  }
  const selected = items.filter(item => item.selected);
  const disabled = !!busy || !ready;
  return <ScrollView style={s.screen} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: 'AI 文档日程助手' }} />
    <Text style={s.title}>把通知变成待办日程</Text>
    <Text style={s.hint}>拍摄通知、从相册选图、导入文件或粘贴文字，AI 会提取与你相关的事项。只有你确认的内容才会加入本 APP 日程。</Text>
    <Text style={s.label}>我的身份与职责</Text>
    <TextInput editable={!disabled} style={s.input} multiline maxLength={2000} value={profile} onChangeText={value => { setProfile(value); setConsent(false); }} placeholder="例如：我是李老师，三年级二班班主任，负责本班家长通知与材料提交。" />
    <Text style={s.label}>DeepSeek 直连设置</Text>
    <Text style={s.warning}>仅建议个人自用。API Key 会由本 APP 直接发送给 DeepSeek，不经过自建服务器。</Text>
    <TextInput editable={!disabled} style={s.input} autoCapitalize="none" autoCorrect={false} secureTextEntry value={apiKey} onChangeText={value => { setApiKey(value); setConsent(false); }} placeholder="DeepSeek API Key" />
    <TextInput editable={!disabled} style={s.input} autoCapitalize="none" autoCorrect={false} value={model} onChangeText={value => { setModel(value); setConsent(false); }} placeholder="模型名称，例如 deepseek-flash" />
    <Text style={s.hint}>分析文件或照片时请保持使用 deepseek-flash；仅分析粘贴文本时可改用其他 DeepSeek 模型。</Text>
    <View style={s.row}><Switch disabled={disabled} value={rememberKey} onValueChange={value => void updateRememberKey(value)} /><Text style={s.consent}>在此设备安全保存 API Key（iOS Keychain / Android Keystore）</Text></View>
    {!!apiKey && <Pressable disabled={disabled} style={s.secondary} onPress={() => void run('正在清除…', async () => { await clearDeepSeekApiKey(); setApiKey(''); setRememberKey(false); setConsent(false); setMessage('已从设备安全存储中清除 API Key。'); })}><Text style={s.link}>清除设备中的 API Key</Text></Pressable>}
    <Pressable accessibilityRole="button" disabled={disabled} style={s.secondary} onPress={() => void run('读取文件…', async () => { const next = await pickDocument(); if (next) { setFile(next); setConsent(false); } })}><Text style={s.link}>＋ 导入 Excel、Word、PDF 或文本（最多 10 MB）</Text></Pressable>
    {file && <Pressable disabled={disabled} onPress={() => { setFile(null); setConsent(false); }}><Text style={s.link}>{file.name}　× 移除</Text></Pressable>}
    <Text style={s.label}>照片 OCR</Text>
    <View style={s.row}>
      <Pressable accessibilityRole="button" disabled={disabled || images.length >= MAX_IMAGE_COUNT} style={[s.photoButton, (disabled || images.length >= MAX_IMAGE_COUNT) && s.dim]} onPress={() => void run('正在打开相机…', async () => {
        const next = await takePhoto();
        if (next) { setImages(current => [...current, next]); setConsent(false); }
      })}><Text style={s.link}>拍照识别</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={disabled || images.length >= MAX_IMAGE_COUNT} style={[s.photoButton, (disabled || images.length >= MAX_IMAGE_COUNT) && s.dim]} onPress={() => void run('正在打开相册…', async () => {
        const next = await pickImages(MAX_IMAGE_COUNT - images.length);
        if (next.length) { setImages(current => [...current, ...next]); setConsent(false); }
      })}><Text style={s.link}>从相册选择</Text></Pressable>
    </View>
    <Text style={s.hint}>最多 {MAX_IMAGE_COUNT} 张，每张不超过 10 MB。拍摄时尽量正对纸面、保持光线均匀，并让文字清晰完整。</Text>
    {!!images.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.previewRow}>
      {images.map((image, index) => <View key={image.uri} style={s.previewCard}>
        <Image source={{ uri: image.uri }} style={s.previewImage} resizeMode="cover" />
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => removeImage(index)}><Text style={s.remove}>移除</Text></Pressable>
      </View>)}
    </ScrollView>}
    <TextInput editable={!disabled} style={[s.input, s.textarea]} multiline maxLength={30000} value={text} onChangeText={value => { setText(value); setConsent(false); }} placeholder="也可以在这里粘贴其他 APP 中的通知…" />
    <View style={s.row}><Switch disabled={disabled} value={consent} onValueChange={setConsent} /><Text style={s.consent}>同意将所选照片、文档、通知和身份信息直接发送至 DeepSeek 分析。分析完成后会请求删除远程临时文件。</Text></View>
    <Pressable accessibilityRole="button" disabled={disabled || !consent || !apiKey.trim() || !model.trim() || !profile.trim() || (!file && !images.length && !text.trim())} style={[s.button, (disabled || !consent || !apiKey.trim() || !model.trim() || !profile.trim() || (!file && !images.length && !text.trim())) && s.dim]} onPress={() => void run('AI 正在分析…', async () => {
      if (rememberKey) await saveDeepSeekApiKey(apiKey.trim());
      else await clearDeepSeekApiKey();
      const result = await analyzeDocument({ apiKey, model, profile, text, file, images });
      setSummary(result.summary); setSource(describeSource());
      setItems(result.items.map(item => ({ ...item, selected: false })));
      if (!result.items.length) setMessage('未发现与你相关的可安排事项。');
    })}><Text style={s.buttonText}>{busy || '分析并生成建议'}</Text></Pressable>
    {!!message && <Text accessibilityLiveRegion="polite" style={s.hint}>{message}</Text>}
    {!!summary && <View style={s.card}><Text style={s.label}>分析摘要 · {source}</Text><Text style={s.body}>{summary}</Text></View>}
    {!!items.length && <><Text style={s.title}>待确认事项 · {items.length}</Text><Text style={s.hint}>时间按设备时区 {Intl.DateTimeFormat().resolvedOptions().timeZone} 显示。请核对原文，并补全空缺的日期和时间；默认不勾选。</Text></>}
    {items.map((item, index) => <View key={index} style={s.card}>
      <View style={s.row}><Switch disabled={disabled} value={item.selected} onValueChange={selected => edit(index, { selected })} /><Text style={s.label}>加入此事项</Text></View>
      <TextInput editable={!disabled} style={s.input} value={item.title} onChangeText={title => edit(index, { title })} multiline maxLength={5000} />
      <Text style={s.hint}>原文依据：{item.evidence}</Text><Text style={s.hint}>与我相关：{item.relevance}</Text>
      {!!item.uncertainty && <Text style={s.warning}>待核对：{item.uncertainty}</Text>}
      <View style={s.row}><TextInput editable={!disabled} style={[s.input, s.flex]} value={item.date ?? ''} onChangeText={date => edit(index, { date: date || null })} placeholder="日期 YYYY-MM-DD" /><TextInput editable={!disabled} style={[s.input, s.flex]} value={item.time ?? ''} onChangeText={time => edit(index, { time: time || null })} placeholder="时间 HH:mm" /></View>
    </View>)}
    {!!items.length && <Pressable accessibilityRole="button" disabled={disabled || !selected.length} style={[s.button, (disabled || !selected.length) && s.dim]} onPress={() => void run('正在加入日程…', async () => {
      const result = await confirmSuggestions(selected, source);
      setItems(current => current.filter(item => !item.selected));
      await dispatch(loadTasks());
      setMessage(`已加入 ${result.added} 条日程，跳过 ${result.duplicates} 条重复事项。${result.remindersFailed ? `${result.remindersFailed} 条提醒未开启，请检查通知权限；日程已保存。` : ''}`);
    })}><Text style={s.buttonText}>确认加入 {selected.length} 条日程</Text></Pressable>}
    {!!summary && <Pressable disabled={disabled} style={s.secondary} onPress={() => { setItems([]); setSummary(''); setSource(''); setMessage('已清空草稿，已加入的日程不受影响。'); }}><Text style={s.link}>清空分析草稿</Text></Pressable>}
  </ScrollView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffdf8' }, container: { padding: 20, gap: 12, paddingBottom: 60 },
  title: { fontSize: 23, color: '#263c36', fontWeight: '700', marginTop: 12 }, label: { fontSize: 15, fontWeight: '600', color: '#40574f' },
  hint: { color: '#667d72', lineHeight: 22 }, body: { color: '#263c36', lineHeight: 24 }, input: { backgroundColor: '#f2f7f3', borderRadius: 12, padding: 14, color: '#263c36', fontSize: 16 },
  textarea: { minHeight: 110, textAlignVertical: 'top' }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, flex: { flex: 1 },
  consent: { flex: 1, color: '#667d72', fontSize: 13, lineHeight: 19 }, button: { backgroundColor: '#347d65', padding: 16, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 }, secondary: { paddingVertical: 12 }, link: { color: '#347d65' },
  photoButton: { flex: 1, borderColor: '#b9d2c5', borderWidth: 1, borderRadius: 12, padding: 13, alignItems: 'center' },
  previewRow: { gap: 10, paddingVertical: 2 }, previewCard: { width: 104, gap: 6 }, previewImage: { width: 104, height: 104, borderRadius: 12, backgroundColor: '#edf3ef' }, remove: { color: '#a14c42', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderColor: '#dde9e1', borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 }, warning: { color: '#94611b', lineHeight: 22 }, dim: { opacity: 0.45 },
});
