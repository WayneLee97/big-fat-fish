import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { getStoredMediaFile } from "./fileStorage";

export async function pickAndPersistImages(limit = 5) {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: limit, quality: 0.9 });
  if (result.canceled) return [];
  const persisted: string[] = [];
  for (const [index, asset] of result.assets.entries()) {
    const extension = asset.fileName?.split(".").pop() ?? "jpg";
    const destination = getStoredMediaFile("image", `${Date.now()}-${index}.${extension}`);
    await new File(asset.uri).copy(destination);
    persisted.push(destination.uri);
  }
  return persisted;
}
