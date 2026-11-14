import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { SchoolClass } from "@/data/school";
import { listClasses } from "@/data/schoolRepository";
import {
  CLASSROOM_MESSAGE_MAX_LENGTH,
  clearClassroomConnection,
  loadClassroomConnection,
  pairClassroomDevice,
  pairClassroomDeviceFromQr,
  saveClassroomConnection,
  sendClassroomMessage,
  testClassroomConnection,
  waitForClassroomMessage,
  type ClassroomMessage,
} from "@/services/classroom/classroomClient";
import type { ClassroomHistoryItem } from "@/services/classroom/classroomHistory";
import { useClassroomDiscovery } from "@/services/classroom/useClassroomDiscovery";

const statusLabels: Record<string, string> = {
  received: "电脑已接收",
  displaying: "通知已展示",
  speaking: "正在播报",
  played: "播报完成",
  failed: "播报失败",
  expired: "消息已过期",
  duplicate: "消息已接收",
};

function historyTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ClassroomCall() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [address, setAddress] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [content, setContent] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [message, setMessage] = useState<ClassroomMessage | null>(null);
  const pageSession = useRef(0);
  const [history, setHistory] = useState<ClassroomHistoryItem[]>([]);
  const [busy, setBusy] = useState<"testing" | "sending" | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const discovery = useClassroomDiscovery();

  const loadConnection = useCallback(async (nextClassId: string) => {
    const connection = await loadClassroomConnection(nextClassId);
    setAddress(connection?.baseUrl ?? "");
    setAccessToken(connection?.accessToken ?? "");
    setDeviceLabel(connection?.deviceName ?? "");
    setDeviceId(connection?.deviceId ?? "");
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    const matched = discovery.devices.find((device) => device.deviceId === deviceId);
    if (matched?.baseUrls[0] && matched.baseUrls[0] !== address) setAddress(matched.baseUrls[0]);
  }, [address, deviceId, discovery.devices]);

  // A focus session owns its in-memory receipts; old requests cannot refill a new visit.
  useFocusEffect(useCallback(() => {
    pageSession.current += 1;
    setHistory([]);
    setMessage(null);
    setBusy(null);
    return () => { pageSession.current += 1; };
  }, []));

  useFocusEffect(useCallback(() => {
    void (async () => {
      const items = await listClasses();
      setClasses(items);
      const firstId = classId && items.some((item) => item.id === classId) ? classId : items[0]?.id ?? "";
      setClassId(firstId);
      if (firstId) await loadConnection(firstId);
    })();
  }, [classId, loadConnection]));

  const chooseClass = async (nextClassId: string) => {
    setClassId(nextClassId);
    await loadConnection(nextClassId);
  };

  const testConnection = async () => {
    if (!classId) return Alert.alert("还没有班级", "请先在学生管理中添加班级。");
    if (!accessToken.trim()) return Alert.alert("缺少访问码", "请填写 Windows 客户端显示的设备访问码。");
    setBusy("testing");
    try {
      const health = await testClassroomConnection(address, accessToken.trim());
      await saveClassroomConnection(classId, { baseUrl: health.baseUrl, accessToken, deviceId: health.deviceId, deviceName: health.deviceName });
      setAddress(health.baseUrl);
      setDeviceLabel(health.deviceName);
      Alert.alert("连接成功", `已连接电脑：${health.deviceName}`);
    } catch (error) {
      Alert.alert("连接失败", error instanceof Error ? error.message : "请检查电脑客户端和网络");
    } finally { setBusy(null); }
  };

  const pair = async () => {
    const schoolClass = classes.find((item) => item.id === classId);
    if (!schoolClass) return Alert.alert("还没有班级", "请先在学生管理中添加班级。");
    setBusy("testing");
    try {
      const connection = await pairClassroomDevice(address, pairingCode, schoolClass);
      setAddress(connection.baseUrl); setAccessToken(connection.accessToken); setDeviceId(connection.deviceId ?? ""); setDeviceLabel(connection.deviceName ?? ""); setPairingCode("");
      Alert.alert("绑定成功", `${schoolClass.name}已绑定到电脑：${connection.deviceName}`);
    } catch (error) {
      Alert.alert("绑定失败", error instanceof Error ? error.message : "请检查地址和配对码");
    } finally { setBusy(null); }
  };

  const resetBinding = async () => {
    if (!classId) return;
    try { await clearClassroomConnection(classId); } catch { /* the new pairing will overwrite stale local data */ }
    setAccessToken(""); setDeviceLabel(""); setPairingCode("");
  };

  const openScanner = async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) return Alert.alert("无法使用相机", "请在系统设置中允许大肥鱼访问相机，或手工填写电脑地址和配对码。");
    setScanLocked(false);
    setScannerVisible(true);
  };

  const scanPairingCode = async ({ data }: BarcodeScanningResult) => {
    if (scanLocked) return;
    const schoolClass = classes.find((item) => item.id === classId);
    if (!schoolClass) return;
    setScanLocked(true); setScannerVisible(false); setBusy("testing");
    try {
      const connection = await pairClassroomDeviceFromQr(data, schoolClass);
      setAddress(connection.baseUrl); setAccessToken(connection.accessToken); setDeviceId(connection.deviceId ?? ""); setDeviceLabel(connection.deviceName ?? ""); setPairingCode("");
      Alert.alert("绑定成功", `${schoolClass.name}已绑定到电脑：${connection.deviceName}`);
    } catch (error) {
      Alert.alert("扫码绑定失败", error instanceof Error ? error.message : "请重新扫描客户端二维码");
    } finally { setBusy(null); setScanLocked(false); }
  };

  const send = async () => {
    if (!classId) return Alert.alert("还没有班级", "请先添加班级。");
    const session = pageSession.current;
    const isCurrentSession = () => pageSession.current === session;
    setBusy("sending"); setMessage(null);
    try {
      const health = await testClassroomConnection(address, accessToken.trim());
      const connection = { baseUrl: health.baseUrl, accessToken, deviceId: health.deviceId, deviceName: health.deviceName };
      await saveClassroomConnection(classId, connection);
      if (!isCurrentSession()) return;
      setDeviceLabel(health.deviceName);
      const accepted = await sendClassroomMessage(connection, classId, content);
      const updateReceipt = (receipt: ClassroomMessage) => {
        if (!isCurrentSession()) return;
        setMessage(receipt);
        const item: ClassroomHistoryItem = {
          messageId: receipt.messageId, classId: receipt.classId,
          deviceId: connection.deviceId ?? null, deviceName: connection.deviceName ?? null,
          content: receipt.content, status: receipt.status, errorMessage: receipt.errorMessage ?? null,
          createdAt: receipt.createdAt, updatedAt: receipt.updatedAt,
        };
        setHistory(current => [item, ...current.filter(entry => entry.messageId !== item.messageId)]
          .sort((a, b) => b.createdAt - a.createdAt));
      };
      if (!isCurrentSession()) return;
      updateReceipt(accepted);
      const finalMessage = await waitForClassroomMessage(connection, accepted, updateReceipt);
      updateReceipt(finalMessage);
      if (isCurrentSession() && finalMessage.status === "played") setContent("");
    } catch (error) {
      if (isCurrentSession()) Alert.alert("发送失败", error instanceof Error ? error.message : "无法连接教室电脑");
    } finally { if (isCurrentSession()) setBusy(null); }
  };

  const visibleHistory = history.filter(item => item.classId === classId).slice(0, 20);

  const selectedClass = classes.find((item) => item.id === classId);
  if (scannerVisible) return <SafeAreaView style={styles.scannerPage}>
    <Stack.Screen options={{ title: "扫描教室电脑" }} />
    <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanLocked ? undefined : (result) => void scanPairingCode(result)} />
    <View style={styles.scanOverlay}><View style={styles.scanFrame} /><Text style={styles.scanText}>将教室电脑上的二维码放入框内</Text><Pressable onPress={() => setScannerVisible(false)} style={styles.scanCancel}><Text style={styles.scanCancelText}>取消扫描</Text></Pressable></View>
  </SafeAreaView>;
  return <SafeAreaView style={styles.safe}>
    <Stack.Screen options={{ title: "教室呼叫" }} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}><Text style={styles.introTitle}>发送文字到教室电脑</Text><Text style={styles.introText}>手机和电脑需要连接同一个可互访的局域网。电脑接收后会显示通知并自动朗读。</Text></View>

        <Text style={styles.label}>指定班级</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {classes.map((item) => <Pressable key={item.id} onPress={() => void chooseClass(item.id)} style={[styles.chip, item.id === classId && styles.chipActive]}><Text style={item.id === classId ? styles.chipTextActive : styles.chipText}>{item.name}</Text></Pressable>)}
        </ScrollView>
        {!classes.length && <Text style={styles.hint}>请先在学生管理中添加班级。</Text>}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>教室电脑</Text>
          <View style={styles.discoveryHeader}><Text style={styles.discoveryTitle}>{discovery.isScanning ? "正在查找局域网电脑…" : `发现 ${discovery.devices.length} 台教室电脑`}</Text><Pressable onPress={discovery.restart}><Text style={styles.rebind}>重新查找</Text></Pressable></View>
          {!!discovery.error && <Text style={styles.discoveryHint}>{discovery.error}</Text>}
          {discovery.devices.map((device) => <Pressable key={device.deviceId} onPress={() => { if (device.deviceId !== deviceId) setAccessToken(""); setAddress(device.baseUrls[0]); setDeviceId(device.deviceId); setDeviceLabel(device.deviceName); }} style={[styles.deviceRow, device.deviceId === deviceId && styles.deviceRowActive]}><View><Text style={styles.deviceName}>{device.deviceName}</Text><Text style={styles.discoveryHint}>{device.className || "尚未绑定班级"} · {device.baseUrls[0]}</Text></View><Text style={styles.deviceAction}>{device.deviceId === deviceId ? "已选择" : "选择"}</Text></Pressable>)}
          <Pressable disabled={busy !== null || !selectedClass} onPress={() => void openScanner()} style={[styles.scanButton, (busy !== null || !selectedClass) && styles.disabled]}><Text style={styles.scanButtonText}>▣ 扫描电脑二维码绑定</Text></Pressable>
          <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>或手工填写</Text><View style={styles.orLine} /></View>
          <TextInput value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="例如 192.168.1.20:32145" style={styles.input} />
          {!accessToken ? <><TextInput value={pairingCode} onChangeText={setPairingCode} keyboardType="number-pad" maxLength={6} placeholder="Windows 客户端显示的六位配对码" style={styles.input} /><Pressable disabled={busy !== null} onPress={() => void pair()} style={[styles.secondary, busy && styles.disabled]}><Text style={styles.secondaryText}>{busy === "testing" ? "正在绑定…" : `绑定${selectedClass?.name ?? "班级"}`}</Text></Pressable></> : <><Pressable disabled={busy !== null} onPress={() => void testConnection()} style={[styles.secondary, busy && styles.disabled]}><Text style={styles.secondaryText}>{busy === "testing" ? "正在测试…" : "测试已绑定电脑"}</Text></Pressable><Pressable onPress={() => void resetBinding()}><Text style={styles.rebind}>重新绑定这台电脑</Text></Pressable></>}
          {!!deviceLabel && <Text style={styles.connected}>已选择：{deviceLabel} · {selectedClass?.name}</Text>}
        </View>

        <Text style={styles.label}>通知内容</Text>
        <View style={styles.composer}>
          <TextInput value={content} onChangeText={setContent} multiline maxLength={CLASSROOM_MESSAGE_MAX_LENGTH} placeholder="例如：请李明同学下课后到办公室。" style={styles.contentInput} />
          <Text style={styles.counter}>{content.length}/{CLASSROOM_MESSAGE_MAX_LENGTH}</Text>
        </View>
        <Pressable disabled={busy !== null || !content.trim()} onPress={() => void send()} style={[styles.primary, (busy !== null || !content.trim()) && styles.disabled]}>
          {busy === "sending" && <ActivityIndicator color="#fff" />}
          <Text style={styles.primaryText}>{busy === "sending" ? "等待电脑回执…" : `发送到${selectedClass?.name ?? "班级"}`}</Text>
        </Pressable>

        {message && message.classId === classId && <View style={[styles.result, message.status === "failed" && styles.resultFailed]}><Text style={styles.resultTitle}>{statusLabels[message.status] ?? message.status}</Text><Text style={styles.resultText}>{message.errorMessage || message.content}</Text></View>}

        {!!visibleHistory.length && <View style={styles.historySection}>
          <Text style={styles.label}>最近发送</Text>
          {visibleHistory.map((item) => <View key={item.messageId} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={[styles.historyStatus, item.status === "failed" && styles.historyStatusFailed]}>{statusLabels[item.status] ?? item.status}</Text>
              <Text style={styles.historyTime}>{historyTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.historyContent}>{item.content}</Text>
            <View style={styles.historyFooter}>
              <Text numberOfLines={1} style={styles.historyDevice}>{item.deviceName || "教室电脑"}{item.errorMessage ? ` · ${item.errorMessage}` : ""}</Text>
              <Pressable onPress={() => setContent(item.content)}><Text style={styles.resend}>再次发送</Text></Pressable>
            </View>
          </View>)}
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fffdf8" }, flex: { flex: 1 }, scroll: { padding: 20, paddingBottom: 50, gap: 14 },
  intro: { backgroundColor: "#dff3e9", borderRadius: 22, padding: 20 }, introTitle: { color: "#31594b", fontSize: 21, fontWeight: "700" }, introText: { color: "#628177", lineHeight: 22, marginTop: 8 },
  label: { color: "#40574f", fontSize: 15, fontWeight: "700", marginTop: 4 }, chips: { gap: 8 }, chip: { backgroundColor: "#f1f6f2", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 }, chipActive: { backgroundColor: "#bfe5d6" }, chipText: { color: "#789087" }, chipTextActive: { color: "#267b63", fontWeight: "700" }, hint: { color: "#8ca198" },
  card: { backgroundColor: "#f4f8f4", borderRadius: 20, padding: 18, gap: 11 }, cardTitle: { color: "#31594b", fontSize: 17, fontWeight: "700" }, input: { backgroundColor: "#fff", borderRadius: 12, padding: 13, color: "#263c36" }, secondary: { alignItems: "center", borderWidth: 1, borderColor: "#58b79b", borderRadius: 12, padding: 12 }, secondaryText: { color: "#398e74", fontWeight: "700" }, rebind: { color: "#789087", fontSize: 13, textAlign: "center" }, connected: { color: "#398e74", fontSize: 13 },
  composer: { backgroundColor: "#f4f8f4", borderRadius: 18, padding: 14 }, contentInput: { minHeight: 110, color: "#263c36", fontSize: 17, lineHeight: 25, textAlignVertical: "top" }, counter: { color: "#91a39a", fontSize: 12, textAlign: "right" }, primary: { minHeight: 50, borderRadius: 15, backgroundColor: "#58b79b", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 }, primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 }, disabled: { opacity: .5 },
  result: { backgroundColor: "#e2f4eb", borderRadius: 16, padding: 16 }, resultFailed: { backgroundColor: "#fae7e5" }, resultTitle: { color: "#31594b", fontWeight: "700" }, resultText: { color: "#628177", marginTop: 6, lineHeight: 21 },
  historySection: { gap: 10, marginTop: 4 }, historyCard: { backgroundColor: "#f4f8f4", borderRadius: 16, padding: 14, gap: 8 }, historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, historyStatus: { color: "#398e74", fontSize: 13, fontWeight: "700" }, historyStatusFailed: { color: "#b65c54" }, historyTime: { color: "#91a39a", fontSize: 12 }, historyContent: { color: "#31594b", fontSize: 15, lineHeight: 22 }, historyFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, historyDevice: { color: "#8ca198", fontSize: 12, flex: 1 }, resend: { color: "#398e74", fontSize: 13, fontWeight: "700" },
  scanButton: { backgroundColor: "#58b79b", borderRadius: 13, padding: 13, alignItems: "center" }, scanButtonText: { color: "#fff", fontWeight: "700" }, orRow: { flexDirection: "row", alignItems: "center", gap: 10 }, orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#cedbd4" }, orText: { color: "#91a39a", fontSize: 12 },
  discoveryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, discoveryTitle: { color: "#536960", fontSize: 13, fontWeight: "600" }, discoveryHint: { color: "#8ca198", fontSize: 12, lineHeight: 18 }, deviceRow: { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "transparent" }, deviceRowActive: { borderColor: "#58b79b" }, deviceName: { color: "#31594b", fontWeight: "700" }, deviceAction: { color: "#398e74", fontSize: 13 },
  scannerPage: { flex: 1, backgroundColor: "#111" }, camera: { flex: 1 }, scanOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 30, backgroundColor: "rgba(0,0,0,.22)" }, scanFrame: { width: 260, height: 260, borderRadius: 24, borderWidth: 3, borderColor: "#fff", backgroundColor: "transparent" }, scanText: { color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 24 }, scanCancel: { position: "absolute", bottom: 45, backgroundColor: "rgba(0,0,0,.55)", borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13 }, scanCancelText: { color: "#fff", fontWeight: "700" },
});
