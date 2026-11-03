import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { imageSize } from "image-size";
import type { MultipartFile } from "@fastify/multipart";
import { ApiException } from "../common/api-exception";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/webm": "webm",
};

@Injectable()
export class UploadsService {
  private readonly uploadDir: string;
  private readonly maxBytes: number;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.uploadDir = path.resolve(
      process.cwd(),
      config.get<string>("UPLOAD_DIR") ?? "uploads",
    );
    this.maxBytes = Number(config.get<string>("MAX_UPLOAD_BYTES") ?? 20 * 1024 * 1024);
    this.publicBaseUrl = (config.get<string>("PUBLIC_BASE_URL") ?? "http://localhost:8790").replace(
      /\/+$/,
      "",
    );
  }

  async save(file: MultipartFile) {
    if (!file.mimetype.startsWith("image/")) {
      throw new ApiException(20001, "目前只支持图片上传", 422);
    }
    const extension = EXTENSIONS[file.mimetype];
    if (!extension) {
      throw new ApiException(20001, "仅支持 PNG、JPEG、WebP、GIF", 422);
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      throw new ApiException(20001, "文件读取失败或超过大小限制", 422);
    }
    if (buffer.byteLength > this.maxBytes) {
      throw new ApiException(20001, "文件超过大小限制", 422);
    }

    let width: number | undefined;
    let height: number | undefined;
    try {
      const size = imageSize(buffer);
      width = size.width;
      height = size.height;
    } catch {
      throw new ApiException(20001, "无法解析图片文件", 422);
    }

    const id = randomUUID();
    const filename = `${id}.${extension}`;
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(path.join(this.uploadDir, filename), buffer);

    const digest = createHash("sha256").update(buffer).digest("hex");

    return {
      uploadId: `upl_${id}`,
      url: `${this.publicBaseUrl}/uploads/${filename}`,
      thumbnailUrl: null,
      mimeType: file.mimetype,
      size: buffer.byteLength,
      width,
      height,
      assetId: `asset_${digest.slice(0, 16)}`,
    };
  }

  /** 保存上游返回的二进制媒体（目前用于 TTS 音频）。 */
  async saveBuffer(buffer: Buffer, mimeType: string) {
    const normalized = mimeType.toLowerCase().split(";")[0].trim();
    const extension = AUDIO_EXTENSIONS[normalized];
    if (!extension) {
      throw new ApiException(20001, `不支持的音频格式：${mimeType}`, 422);
    }
    if (buffer.byteLength === 0) {
      throw new ApiException(20001, "音频内容为空", 422);
    }
    if (buffer.byteLength > this.maxBytes) {
      throw new ApiException(20001, "音频文件超过大小限制", 422);
    }

    const id = randomUUID();
    const filename = `${id}.${extension}`;
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(path.join(this.uploadDir, filename), buffer);

    const digest = createHash("sha256").update(buffer).digest("hex");

    return {
      uploadId: `upl_${id}`,
      url: `${this.publicBaseUrl}/uploads/${filename}`,
      mimeType: normalized,
      size: buffer.byteLength,
      assetId: `asset_${digest.slice(0, 16)}`,
    };
  }
}
