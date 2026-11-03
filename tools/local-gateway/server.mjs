#!/usr/bin/env node
/**
 * 本地模型网关：把 ComfyUI 包装成 Infinite Canvas 需要的接口。
 *
 *   GET  /v1/models
 *   POST /v1/images/generations
 *   POST /v1/video/submit
 *   POST /v1/video/status
 *   POST /v1/audio/speech          （Breeze TTS 2，返回 WAV）
 *   GET  /files/<path>            （带 Range，供图片/视频播放）
 *
 * 只依赖 Node 22 内置模块，不需要 npm install。
 *
 * 环境变量：
 *   PORT=8081
 *   COMFY_URL=http://127.0.0.1:8188
 *   COMFY_OUTPUT_DIR=~/ComfyUI/output
 *   PUBLIC_BASE_URL=http://127.0.0.1:8081
 *   TTS_MODEL=breeze-tts-2
 *   TTS_SCRIPT=~/BreezeTTS2_Mac_Streaming/breezetts2_mac_fast.py
 *   TTS_UPSTREAM_URL=            （可选：把 /v1/audio/speech 转发给别的 OpenAI 兼容 TTS 服务）
 */
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8081);
const COMFY_URL = (process.env.COMFY_URL ?? "http://127.0.0.1:8188").replace(/\/+$/, "");
const OUTPUT_DIR = path.resolve(
  process.env.COMFY_OUTPUT_DIR ?? path.join(os.homedir(), "ComfyUI", "output"),
);
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${PORT}`
).replace(/\/+$/, "");
const MAX_IMAGE_SIDE = Number(process.env.MAX_IMAGE_SIDE ?? 768);
const VIDEO_WIDTH = Number(process.env.VIDEO_WIDTH ?? 640);
const VIDEO_HEIGHT = Number(process.env.VIDEO_HEIGHT ?? 384);
const VIDEO_FRAMES = Number(process.env.VIDEO_FRAMES ?? 25);
const VIDEO_FPS = Number(process.env.VIDEO_FPS ?? 16);
const VIDEO_STEPS = Number(process.env.VIDEO_STEPS ?? 16);

const IMAGE_MODEL = process.env.IMAGE_MODEL ?? "flux2-klein-4b";
const IMAGE_CHECKPOINT =
  process.env.IMAGE_CHECKPOINT ?? "v1-5-pruned-emaonly-fp16.safetensors";
const FLUX2_UNET =
  process.env.FLUX2_UNET ?? "flux-2-klein-4b-fp8.safetensors";
const FLUX2_TEXT_ENCODER =
  process.env.FLUX2_TEXT_ENCODER ?? "qwen_3_4b_fp4_flux2.safetensors";
const FLUX2_VAE = process.env.FLUX2_VAE ?? "flux2-vae.safetensors";
const VIDEO_MODEL = process.env.VIDEO_MODEL ?? "wan21-t2v-1.3b";
const VIDEO_UNET = process.env.VIDEO_UNET ?? "wan2.1_t2v_1.3B_fp16.safetensors";
const VIDEO_TEXT_ENCODER =
  process.env.VIDEO_TEXT_ENCODER ?? "umt5_xxl_fp8_e4m3fn_scaled.safetensors";
const VIDEO_VAE = process.env.VIDEO_VAE ?? "wan_2.1_vae.safetensors";

const TTS_MODEL = process.env.TTS_MODEL ?? "breeze-tts-2";
const TTS_SCRIPT = path.resolve(
  process.env.TTS_SCRIPT ??
    path.join(os.homedir(), "BreezeTTS2_Mac_Streaming", "breezetts2_mac_fast.py"),
);
const TTS_UV = process.env.TTS_UV ?? "uv";
const TTS_PYTHON = process.env.TTS_PYTHON ?? "3.12";
const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS ?? 300000);
const TTS_UPSTREAM_URL = (process.env.TTS_UPSTREAM_URL ?? "").replace(/\/+$/, "");

const jobs = new Map();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(payload);
}

function fail(res, status, message) {
  json(res, status, { error: { message } });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(text);
}

function parseSize(value, fallback) {
  const match = /^(\d+)\s*x\s*(\d+)$/i.exec(String(value ?? ""));
  if (!match) return fallback;
  return [Number(match[1]), Number(match[2])];
}

function clampImageSize(width, height, maxSide = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const round = (value) => Math.max(256, Math.round((value * scale) / 64) * 64);
  return [round(width), round(height)];
}

function randomSeed() {
  return randomBytes(4).readUInt32BE(0);
}

async function queuePrompt(graph) {
  const response = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph, client_id: "infinite-canvas-local-gateway" }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.prompt_id) {
    throw new Error(
      `ComfyUI 拒绝了工作流：${data?.error?.message ?? data?.error ?? response.status}`,
    );
  }
  return data.prompt_id;
}

async function historyFor(promptId) {
  const response = await fetch(`${COMFY_URL}/history/${encodeURIComponent(promptId)}`);
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data?.[promptId] ?? null;
}

function outputFile(outputs) {
  for (const node of Object.values(outputs ?? {})) {
    for (const key of ["gifs", "videos", "images"]) {
      const list = node?.[key];
      if (Array.isArray(list) && list[0]?.filename) return list[0];
    }
  }
  return null;
}

function mediaUrl(file) {
  const name = file.subfolder ? `${file.subfolder}/${file.filename}` : file.filename;
  return `${PUBLIC_BASE_URL}/files/${name.split("/").map(encodeURIComponent).join("/")}`;
}

async function uploadReference(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`参考图下载失败：HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/png";
  const extension = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  const form = new FormData();
  form.append("image", new Blob([buffer], { type: contentType }), `reference.${extension}`);
  form.append("overwrite", "true");
  const uploaded = await fetch(`${COMFY_URL}/upload/image`, { method: "POST", body: form });
  const data = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || !data.name) {
    throw new Error(`ComfyUI 上传参考图失败：${data?.error ?? uploaded.status}`);
  }
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

function imageGraph({ prompt, negativePrompt, width, height, seed, referenceName }) {
  const graph = {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: IMAGE_CHECKPOINT },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["1", 1] },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt || "blurry, low quality, watermark", clip: ["1", 1] },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        seed,
        steps: 20,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: referenceName ? ["11", 0] : ["4", 0],
        denoise: referenceName ? 0.65 : 1,
      },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: { samples: ["5", 0], vae: ["1", 2] },
    },
    "7": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "gateway/image", images: ["6", 0] },
    },
  };

  if (referenceName) {
    graph["10"] = {
      class_type: "LoadImage",
      inputs: { image: referenceName },
    };
    graph["11"] = {
      class_type: "VAEEncode",
      inputs: { pixels: ["10", 0], vae: ["1", 2] },
    };
  } else {
    graph["4"] = {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 },
    };
  }
  return graph;
}

function flux2ImageGraph({ prompt, width, height, seed }) {
  return {
    "70": {
      class_type: "UNETLoader",
      inputs: { unet_name: FLUX2_UNET, weight_dtype: "default" },
    },
    "71": {
      class_type: "CLIPLoader",
      inputs: { clip_name: FLUX2_TEXT_ENCODER, type: "flux2", device: "default" },
    },
    "72": {
      class_type: "VAELoader",
      inputs: { vae_name: FLUX2_VAE },
    },
    "66": {
      class_type: "EmptyFlux2LatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "62": {
      class_type: "Flux2Scheduler",
      inputs: { steps: 4, width, height },
    },
    "73": {
      class_type: "RandomNoise",
      inputs: { noise_seed: seed },
    },
    "61": {
      class_type: "KSamplerSelect",
      inputs: { sampler_name: "euler" },
    },
    "74": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["71", 0] },
    },
    "76": {
      class_type: "ConditioningZeroOut",
      inputs: { conditioning: ["74", 0] },
    },
    "63": {
      class_type: "CFGGuider",
      inputs: {
        model: ["70", 0],
        positive: ["74", 0],
        negative: ["76", 0],
        cfg: 1,
      },
    },
    "64": {
      class_type: "SamplerCustomAdvanced",
      inputs: {
        noise: ["73", 0],
        guider: ["63", 0],
        sampler: ["61", 0],
        sigmas: ["62", 0],
        latent_image: ["66", 0],
      },
    },
    "65": {
      class_type: "VAEDecode",
      inputs: { samples: ["64", 0], vae: ["72", 0] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "gateway/flux2", images: ["65", 0] },
    },
  };
}

function videoGraph({ prompt, negativePrompt, width, height, seed }) {
  return {
    "37": {
      class_type: "UNETLoader",
      inputs: { unet_name: VIDEO_UNET, weight_dtype: "default" },
    },
    "38": {
      class_type: "CLIPLoader",
      inputs: { clip_name: VIDEO_TEXT_ENCODER, type: "wan", device: "default" },
    },
    "39": {
      class_type: "VAELoader",
      inputs: { vae_name: VIDEO_VAE },
    },
    "40": {
      class_type: "EmptyHunyuanLatentVideo",
      inputs: { width, height, length: VIDEO_FRAMES, batch_size: 1 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["38", 0] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt || "blurry, low quality, static, watermark", clip: ["38", 0] },
    },
    "48": {
      class_type: "ModelSamplingSD3",
      inputs: { model: ["37", 0], shift: 8 },
    },
    "3": {
      class_type: "KSampler",
      inputs: {
        model: ["48", 0],
        seed,
        steps: VIDEO_STEPS,
        cfg: 6,
        sampler_name: "uni_pc",
        scheduler: "simple",
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["40", 0],
        denoise: 1,
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["39", 0] },
    },
    "49": {
      class_type: "CreateVideo",
      inputs: { images: ["8", 0], fps: VIDEO_FPS },
    },
    "50": {
      class_type: "SaveVideo",
      inputs: {
        video: ["49", 0],
        filename_prefix: "gateway/video",
        format: "auto",
        codec: "auto",
      },
    },
  };
}

async function generateImage(body) {
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt 不能为空");
  const model = String(body.model ?? IMAGE_MODEL);
  const isFlux2 = model.toLowerCase().includes("flux2");
  const maxSide = isFlux2 ? 1024 : MAX_IMAGE_SIDE;
  const [requestedWidth, requestedHeight] = parseSize(body.size, [1024, 1024]);
  const [width, height] = clampImageSize(requestedWidth, requestedHeight, maxSide);
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : randomSeed();
  // FLUX.2 暂时走文生图；参考图编辑留给 SD 1.5 的 img2img 路径。
  const referenceName =
    !isFlux2 && body.image ? await uploadReference(String(body.image)) : null;

  const graph = isFlux2
    ? flux2ImageGraph({ prompt, width, height, seed })
    : imageGraph({
        prompt,
        negativePrompt: body.negative_prompt,
        width,
        height,
        seed,
        referenceName,
      });
  const promptId = await queuePrompt(graph);

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const history = await historyFor(promptId);
    if (history) {
      const status = history.status?.status_str;
      if (status === "error") throw new Error("ComfyUI 图片生成失败");
      const file = outputFile(history.outputs);
      if (file) {
        return {
          created: Math.floor(Date.now() / 1000),
          data: [{ url: mediaUrl(file), width, height }],
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("图片生成超时");
}

async function submitVideo(body) {
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt 不能为空");
  const [requestedWidth, requestedHeight] = parseSize(body.image_size, [
    VIDEO_WIDTH,
    VIDEO_HEIGHT,
  ]);
  const landscape = requestedWidth >= requestedHeight;
  const width = landscape ? VIDEO_WIDTH : VIDEO_HEIGHT;
  const height = landscape ? VIDEO_HEIGHT : VIDEO_WIDTH;
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : randomSeed();

  const graph = videoGraph({
    prompt,
    negativePrompt: body.negative_prompt,
    width,
    height,
    seed,
  });
  const promptId = await queuePrompt(graph);
  const requestId = randomUUID();
  jobs.set(requestId, { promptId, createdAt: Date.now() });
  return { requestId };
}

async function videoStatus(requestId) {
  const job = jobs.get(requestId);
  if (!job) return { status: "failed", reason: "未知的 requestId" };

  const history = await historyFor(job.promptId);
  if (!history) {
    const queue = await fetch(`${COMFY_URL}/queue`)
      .then((response) => response.json())
      .catch(() => ({}));
    const pending = (queue.queue_pending ?? []).some((item) => item?.[1] === job.promptId);
    return { status: pending ? "inqueue" : "running" };
  }

  const status = history.status?.status_str;
  if (status === "error") {
    const messages = (history.status?.messages ?? [])
      .filter((item) => Array.isArray(item) && item[0] === "execution_error")
      .map((item) => item[1]?.exception_message)
      .filter(Boolean);
    return { status: "failed", reason: messages[0] ?? "ComfyUI 视频生成失败" };
  }

  const file = outputFile(history.outputs);
  if (!file) return { status: "running" };
  jobs.delete(requestId);
  return {
    status: "succeed",
    results: {
      videos: [{ url: mediaUrl(file), width: VIDEO_WIDTH, height: VIDEO_HEIGHT }],
    },
  };
}

function runCommand(command, args, { cwd, timeoutMs = TTS_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`TTS 生成超时（${Math.round(timeoutMs / 1000)}s）`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = (stderr || stdout).trim().slice(-800);
      reject(new Error(`TTS 进程退出码 ${code}${detail ? `：${detail}` : ""}`));
    });
  });
}

async function synthesizeSpeech(body) {
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) throw new Error("input 不能为空");
  const instruct = typeof body.instruct === "string" ? body.instruct.trim() : "";

  if (TTS_UPSTREAM_URL) {
    const response = await fetch(`${TTS_UPSTREAM_URL}/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: body.model || TTS_MODEL }),
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`上游 TTS 失败（HTTP ${response.status}）${detail ? `：${detail}` : ""}`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") ?? "audio/wav",
    };
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "breeze-tts-"));
  try {
    const output = path.join(dir, "speech");
    const args = [
      "run",
      "--python",
      TTS_PYTHON,
      TTS_SCRIPT,
      "--no-play",
      "--runs",
      "1",
      "--text",
      input,
      "--output",
      output,
    ];
    if (instruct) args.push("--instruct", instruct);
    await runCommand(TTS_UV, args, { cwd: path.dirname(TTS_SCRIPT) });
    const buffer = await readFile(`${output}_1.wav`);
    return { buffer, mimeType: "audio/wav" };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

async function serveFile(req, res, relative) {
  const root = OUTPUT_DIR.endsWith(path.sep) ? OUTPUT_DIR : `${OUTPUT_DIR}${path.sep}`;
  const filePath = path.resolve(OUTPUT_DIR, relative);
  if (!filePath.startsWith(root)) return fail(res, 403, "forbidden");

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return fail(res, 404, "not found");
  }
  if (!info.isFile()) return fail(res, 404, "not found");

  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": MIME[extension] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  };

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : info.size - 1;
      if (start <= end && end < info.size) {
        res.writeHead(206, {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Content-Length": end - start + 1,
        });
        createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
  }

  res.writeHead(200, { ...headers, "Content-Length": info.size });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/v1/models") {
      const imageModels = [...new Set([IMAGE_MODEL, "sd15"])];
      json(res, 200, {
        object: "list",
        data: [
          ...imageModels.map((id) => ({ id, object: "model", owned_by: "local" })),
          { id: VIDEO_MODEL, object: "model", owned_by: "local" },
          { id: TTS_MODEL, object: "model", owned_by: "local" },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/health") {
      json(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/images/generations") {
      const body = await readJson(req);
      json(res, 200, await generateImage(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/video/submit") {
      const body = await readJson(req);
      json(res, 200, await submitVideo(body));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/video/status") {
      const body = await readJson(req);
      json(res, 200, await videoStatus(String(body.requestId ?? "")));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/audio/speech") {
      const body = await readJson(req);
      const { buffer, mimeType } = await synthesizeSpeech(body);
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": buffer.byteLength,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(buffer);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/files/")) {
      const relative = decodeURIComponent(url.pathname.slice("/files/".length));
      await serveFile(req, res, relative);
      return;
    }

    fail(res, 404, `unknown route ${req.method} ${url.pathname}`);
  } catch (error) {
    console.error(error);
    fail(res, 500, error instanceof Error ? error.message : String(error));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`local-gateway listening on http://127.0.0.1:${PORT}`);
  console.log(`comfy=${COMFY_URL} output=${OUTPUT_DIR}`);
  console.log(`image=${IMAGE_MODEL} video=${VIDEO_MODEL}`);
});
