export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export type LoadedVideo = {
  blob: Blob;
  width: number;
  height: number;
  name: string;
};

export async function readVideoFile(file: File): Promise<LoadedVideo> {
  if (!file.type.startsWith("video/")) {
    throw new Error(`${file.name}: 仅支持视频文件.`);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(`${file.name}: 视频不能超过 200 MB。`);
  }

  const url = URL.createObjectURL(file);
  try {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
      };
      video.onerror = () => reject(new Error(`${file.name}: 无法读取视频。`));
      video.src = url;
    });
    return { blob: file, width: size.width, height: size.height, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}
