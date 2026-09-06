import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

export function ImageViewerModal({ images, index, onClose }: { images: string[]; index: number | null; onClose: () => void }) {
  if (index == null || !images[index]) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>关闭</Text></Pressable><Image source={images[index]} style={styles.image} contentFit="contain" /></View></Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.92)", justifyContent: "center", alignItems: "center" }, image: { width: "100%", height: "80%" }, close: { position: "absolute", top: 60, right: 20, zIndex: 2, padding: 10 }, closeText: { color: "#fff", fontSize: 16 } });
