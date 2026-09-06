import { AudioModule, RecordingPresets, useAudioRecorder, useAudioRecorderState, createAudioPlayer } from "expo-audio";
import { useEffect, useState } from "react";
import { Alert, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { File } from "expo-file-system";
import { getStoredMediaFile } from "@/services/media/fileStorage";

export function AudioRecorderPanel({ onSaved }: { onSaved: (uri: string) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); const state = useAudioRecorderState(recorder); const [saving, setSaving] = useState(false);
  useEffect(() => { const subscription = AppState.addEventListener("change", (nextState) => { if (nextState !== "active" && recorder.isRecording) void recorder.stop(); }); return () => subscription.remove(); }, [recorder]);
  async function toggle() { if (state.isRecording) { setSaving(true); await recorder.stop(); const uri = recorder.uri; if (uri) { const destination = getStoredMediaFile("audio", `${Date.now()}.m4a`); await new File(uri).copy(destination); onSaved(destination.uri); } setSaving(false); return; } const permission = await AudioModule.requestRecordingPermissionsAsync(); if (!permission.granted) { Alert.alert("需要麦克风权限", "请在系统设置中允许班主任工作台访问麦克风"); return; } await recorder.prepareToRecordAsync(); recorder.record(); }
  return <View style={styles.container}><Pressable disabled={saving} onPress={toggle} style={[styles.button, state.isRecording && styles.recording]}><Text style={styles.buttonText}>{saving ? "保存中…" : state.isRecording ? "停止录音" : "开始录音"}</Text></Pressable>{state.isRecording && <Text style={styles.time}>{Math.floor(state.durationMillis / 1000)} 秒</Text>}</View>;
}

export function AudioPlayerButton({ uri }: { uri: string }) { const [playing, setPlaying] = useState(false); const [player] = useState(() => createAudioPlayer(uri)); useEffect(() => () => player.remove(), [player]); return <Pressable style={styles.play} onPress={() => { if (playing) player.pause(); else player.play(); setPlaying(!playing); }}><Text style={styles.playText}>{playing ? "Ⅱ 暂停录音" : "▶ 播放录音"}</Text></Pressable>; }

const styles = StyleSheet.create({ container: { flexDirection: "row", alignItems: "center", gap: 12 }, button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 18, backgroundColor: "#bfe5d6" }, recording: { backgroundColor: "#f4c8c5" }, buttonText: { color: "#267b63", fontWeight: "700" }, time: { color: "#8ca198" }, play: { padding: 10, borderRadius: 14, backgroundColor: "#edf6f1" }, playText: { color: "#4aa488" } });
