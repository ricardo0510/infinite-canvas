export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const MAX_WIDTH = 320;
const MAX_HEIGHT = 320;
const MIN_WIDTH = 140;
const MIN_HEIGHT = 100;

export type LoadedImage = {
  blob: Blob;
  width: number;
  height: number;
  name: string;
};

/**
 * Fits an image inside a 320×320 box without upscaling, then clamps the node
 * to a usable minimum. The image itself keeps its aspect ratio via object-fit.
 */
export function fitImageSize(
  width: number,
  height: number,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 280, height: 220 };
  const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
  return {
    width: Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width * scale))),
    height: Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height * scale))),
  };
}

async function decodeSize(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  }

  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("the image could not be decoded."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name}: only image files are supported.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name}: image is larger than 4 MB.`);
  }

  try {
    const { width, height } = await decodeSize(file);
    return { blob: file, width, height, name: file.name };
  } catch {
    throw new Error(`${file.name}: could not decode the image.`);
  }
}
