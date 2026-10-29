import type { XYPosition } from "@xyflow/react";
import { AI_NODE_WIDTH, mediaNodeHeight } from "./geometry";
import { storeImage } from "./imageStore";
import { readImageFile } from "./images";
import { readVideoFile } from "./videos";
import { useCanvasStore } from "../store/canvasStore";

export async function createUploadedNode(file: File, position: XYPosition): Promise<string> {
  const store = useCanvasStore.getState();
  if (file.type.startsWith("image/")) {
    const image = await readImageFile(file);
    const ref = await storeImage(image.blob);
    const [id] = store.addImages([
      {
        position,
        src: ref,
        width: image.width,
        height: image.height,
        alt: file.name,
      },
    ]);
    return id;
  }

  if (file.type.startsWith("video/")) {
    const video = await readVideoFile(file);
    const ref = await storeImage(video.blob);
    const id = store.addNode("video", position);
    useCanvasStore.getState().updateNodeData(id, {
      title: file.name,
      static: true,
      src: ref,
      thumbnailUrl: "",
      alt: file.name,
    });
    useCanvasStore
      .getState()
      .resizeNode(id, AI_NODE_WIDTH, mediaNodeHeight(AI_NODE_WIDTH, video.width, video.height));
    return id;
  }

  throw new Error("仅支持图片或视频文件。");
}
