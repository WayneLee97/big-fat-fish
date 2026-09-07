import { ensureMediaDirectories, getStoredMediaFile } from "@/services/media/fileStorage";
import { AudioModule, createAudioPlayer, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Pressable, StyleSheet, Text, View } from "react-native";

export function AudioRecorderPanel({ onSaved }: { onSaved: (uri: string) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState<boolean | null>(null);
  const operationInProgress = useRef(false);
  const mounted = useRef(true);

  async function stopAndSave() {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) throw new Error("录音文件未生成");
    await ensureMediaDirectories();
    const destination = getStoredMediaFile("audio", `${Date.now()}.m4a`);
    new File(uri).copy(destination);
    if (mounted.current) onSaved(destination.uri);
  }

  async function toggle(stopOnly = false) {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setBusy(true);
    try {
      if (recorder.isRecording) {
        await stopAndSave();
      } else if (!stopOnly) {
        if (recordingPermission !== true) {
          Alert.alert("需要麦克风权限", "请在系统设置中允许班主任工作台访问麦克风");
          return;
        }
        if (!mounted.current || AppState.currentState !== "active") return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (!mounted.current || AppState.currentState !== "active") return;
        recorder.record();
      }
    } catch (error) {
      if (mounted.current) Alert.alert("录音失败", error instanceof Error ? error.message : "请重试录音");
    } finally {
      if (mounted.current && !recorder.isRecording) {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
      operationInProgress.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const stopOnBackground = useRef(() => {});
  stopOnBackground.current = () => { void toggle(true); };
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const current = await AudioModule.getRecordingPermissionsAsync();
        const permission = current.granted || !current.canAskAgain
          ? current
          : await AudioModule.requestRecordingPermissionsAsync();
        if (mounted.current) setRecordingPermission(permission.granted);
      } catch {
        if (mounted.current) setRecordingPermission(false);
      }
    })();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") stopOnBackground.current();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      // useAudioRecorder releases the recorder when the panel unmounts.
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, []);
  return <View style={styles.container}><Pressable disabled={busy} onPress={() => void toggle()} style={[styles.button, state.isRecording && styles.recording]}><Text style={styles.buttonText}>{busy ? "处理中…" : state.isRecording ? "停止录音" : "开始录音"}</Text></Pressable>{state.isRecording && <Text style={styles.time}>{Math.floor(state.durationMillis / 1000)} 秒</Text>}</View>;
}

export function AudioPlayerButton({ uri }: { uri: string }) { const [playing, setPlaying] = useState(false); const [player] = useState(() => createAudioPlayer(uri)); useEffect(() => () => player.remove(), [player]); return <Pressable style={styles.play} onPress={() => { if (playing) player.pause(); else player.play(); setPlaying(!playing); }}><Text style={styles.playText}>{playing ? "Ⅱ 暂停录音" : "▶ 播放录音"}</Text></Pressable>; }

const styles = StyleSheet.create({ container: { flexDirection: "row", alignItems: "center", gap: 12 }, button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 18, backgroundColor: "#bfe5d6" }, recording: { backgroundColor: "#f4c8c5" }, buttonText: { color: "#267b63", fontWeight: "700" }, time: { color: "#8ca198" }, play: { padding: 10, borderRadius: 14, backgroundColor: "#edf6f1" }, playText: { color: "#4aa488" } });
