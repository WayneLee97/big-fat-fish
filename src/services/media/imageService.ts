import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { ensureMediaDirectories, getStoredMediaFile } from "./fileStorage";

async function persistImages(assets: ImagePicker.ImagePickerAsset[]) {
  await ensureMediaDirectories();
  return assets.map((asset, index) => {
    const extension = asset.uri.split("?")[0].split(".").pop()?.match(/^[a-zA-Z0-9]+$/)?.[0] ?? "jpg";
    const destination = getStoredMediaFile("image", `${Date.now()}-${index}.${extension}`);
    new File(asset.uri).copy(destination);
    return destination.uri;
  });
}

export async function pickAndPersistImages(limit = 5) {
  if (limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: limit, quality: 0.9 });
  return result.canceled ? [] : persistImages(result.assets.slice(0, limit));
}

export async function takeAndPersistPhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("请在系统设置中允许班主任工作台访问相机后，再尝试拍照。");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 });
  return result.canceled ? [] : persistImages(result.assets);
}
