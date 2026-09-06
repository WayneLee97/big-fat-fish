import { Directory, File, Paths } from "expo-file-system";

const root = new Directory(Paths.document, "big-fat-fish");
export const mediaDirectories = {
  images: new Directory(root, "images"),
  audio: new Directory(root, "audio"),
};

export async function ensureMediaDirectories() {
  root.create({ idempotent: true, intermediates: true });
  mediaDirectories.images.create({ idempotent: true, intermediates: true });
  mediaDirectories.audio.create({ idempotent: true, intermediates: true });
}

export function getStoredMediaFile(type: "image" | "audio", fileName: string) {
  return new File(mediaDirectories[type === "image" ? "images" : "audio"], fileName);
}
