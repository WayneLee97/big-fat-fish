import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AudioPlayerButton } from "./AudioRecorderPanel";

export function AudioAttachmentList({ recordings, onRemove }: { recordings: string[]; onRemove: (uri: string) => void }) {
  if (!recordings.length) return null;
  return <View style={styles.list}>{recordings.map((uri, index) => <View key={uri} style={styles.item}><Text style={styles.label}>录音 {index + 1}</Text><AudioPlayerButton uri={uri} /><Pressable onPress={() => Alert.alert("删除录音？", "删除后无法恢复。", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: () => onRemove(uri) }])}><Text style={styles.remove}>删除</Text></Pressable></View>)}</View>;
}
const styles = StyleSheet.create({ list: { gap: 8, marginTop: 10 }, item: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, backgroundColor: "#f3f8f5", borderRadius: 12 }, label: { flex: 1, color: "#536960" }, remove: { color: "#c47777" } });
