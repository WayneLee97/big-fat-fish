import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TaskOccurrence } from "@/data/task";

function formatTime(timestamp: number) { return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(timestamp); }

export function TaskCard({ task, onPress, onComplete }: { task: TaskOccurrence; onPress: () => void; onComplete: () => void }) {
  return <Pressable onPress={onPress} style={[styles.card, task.completed && styles.completedCard]}><View style={[styles.dot, task.completed && styles.completedDot]} /><View style={styles.content}><Text style={[styles.title, task.completed && styles.completedText]}>{task.content}</Text><Text style={styles.meta}>{formatTime(task.remindAt ?? task.eventAt)}{task.kind === "leave" ? " · 学生请假" : ""}</Text></View>{task.completionSupported && !task.completed ? <Pressable onPress={onComplete} hitSlop={10} style={styles.checkButton}><Text style={styles.check}>✓</Text></Pressable> : <Text style={styles.done}>已完成</Text>}</Pressable>;
}

const styles = StyleSheet.create({ card: { flexDirection: "row", alignItems: "center", padding: 16, marginBottom: 10, borderRadius: 18, backgroundColor: "#fff", shadowColor: "#80a99a", shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }, completedCard: { backgroundColor: "#f3f8f5" }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#62b8a1", marginRight: 12 }, completedDot: { backgroundColor: "#b6cfc4" }, content: { flex: 1 }, title: { color: "#263c36", fontSize: 16, fontWeight: "600" }, completedText: { color: "#91a59d", textDecorationLine: "line-through" }, meta: { marginTop: 6, color: "#93a39d", fontSize: 13 }, checkButton: { width: 34, height: 34, borderWidth: 1, borderColor: "#9bd2c0", borderRadius: 17, alignItems: "center", justifyContent: "center" }, check: { color: "#62b8a1", fontSize: 18, fontWeight: "700" }, done: { color: "#a0b2aa", fontSize: 12 } });
