import { getImageBlob, isIdbImageRef } from "../imageStore";
import { aiUpload } from "./http";
import type { ReferenceInput } from "./types";

const cache = new Map<string, string>();

function extensionFor(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("webm")) return "webm";
  return "bin";
}

function fileFromBlob(blob: Blob, prefix: string): File {
  const extension = extensionFor(blob.type);
  return new File([blob], `${prefix}-${Date.now()}.${extension}`, {
    type: blob.type || "application/octet-stream",
  });
}

async function uploadLocal(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;
  let blob: Blob | null = null;
  if (isIdbImageRef(url)) {
    blob = await getImageBlob(url);
    if (!blob) throw new Error("本地图片已丢失，请重新上传");
  } else if (/^data:/i.test(url) || /^blob:/i.test(url)) {
    const response = await fetch(url);
    blob = await response.blob();
  } else if (/^https:\/\//i.test(url)) {
    return url;
  } else {
    throw new Error("不支持的媒体地址");
  }
  if (!blob) throw new Error("无法读取本地媒体");
  if (blob.type.startsWith("video/")) throw new Error("本地视频暂不支持上传，请使用远程视频");
  const upload = await aiUpload(fileFromBlob(blob, "canvas-ref"));
  if (!upload.url) throw new Error("上传失败，未返回地址");
  cache.set(url, upload.url);
  return upload.url;
}

export async function uploadReferences(references: ReferenceInput[]): Promise<ReferenceInput[]> {
  const resolved: ReferenceInput[] = [];
  for (const reference of references) {
    const url = /^https:\/\//i.test(reference.url)
      ? reference.url
      : await uploadLocal(reference.url);
    resolved.push({ ...reference, url });
  }
  return resolved;
}
