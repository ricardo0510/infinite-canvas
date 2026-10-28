export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const MAX_WIDTH = 320;
const MAX_HEIGHT = 320;
const MIN_WIDTH = 140;
const MIN_HEIGHT = 100;

export type LoadedImage = {
  src: string;
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

export function readImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(`${file.name}: only image files are supported.`));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error(`${file.name}: image is larger than 4 MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name}: could not read the file.`));
    reader.onload = () => {
      const src = String(reader.result ?? "");
      if (!src) {
        reject(new Error(`${file.name}: the file is empty.`));
        return;
      }
      const image = new Image();
      image.onload = () => {
        resolve({
          src,
          width: image.naturalWidth,
          height: image.naturalHeight,
          name: file.name,
        });
      };
      image.onerror = () => reject(new Error(`${file.name}: could not decode the image.`));
      image.src = src;
    };
    reader.readAsDataURL(file);
  });
}
