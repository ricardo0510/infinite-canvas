import { getAiApiBase, AI_TIMEOUTS } from "./config";
import { getAiToken, notifyAiUnauthorized } from "./auth";
import type { AiRequestOptions, UploadResult } from "./types";

type Envelope<T> = {
  code: number;
  message: string;
  data?: T;
};

export class AiRequestError extends Error {
  code: number;
  data?: unknown;
  status?: number;

  constructor(code: number, message: string, data?: unknown, status?: number) {
    super(message);
    this.name = "AiRequestError";
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

function toUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getAiApiBase();
  if (!base) throw new AiRequestError(-1, "未配置 AI 接口地址");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function parseEnvelope<T>(value: unknown): Envelope<T> {
  if (typeof value !== "object" || value === null) {
    throw new AiRequestError(-2, "服务响应格式异常");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.code !== "number" || typeof record.message !== "string") {
    throw new AiRequestError(-2, "服务响应格式异常");
  }
  return {
    code: record.code,
    message: record.message,
    data: record.data as T,
  };
}

export async function aiRequest<T>(path: string, options: AiRequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const external = options.signal;
  let timedOut = false;
  const timeout = options.timeout ?? AI_TIMEOUTS.request;
  const timer =
    timeout > 0
      ? window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeout)
      : null;
  const abort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", abort, { once: true });
  }

  try {
    const token = getAiToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined && !isFormData(options.body)) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(toUrl(path), {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body:
        options.body === undefined
          ? undefined
          : isFormData(options.body)
            ? options.body
            : JSON.stringify(options.body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 204) return undefined as T;
    const raw = await response.text();
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      throw new AiRequestError(-2, `服务响应格式异常（HTTP ${response.status}）`, undefined, response.status);
    }
    const envelope = parseEnvelope<T>(parsed);
    if (envelope.code !== 0) {
      if (envelope.code === 10001 || response.status === 401) notifyAiUnauthorized();
      throw new AiRequestError(envelope.code, envelope.message, envelope.data, response.status);
    }
    return envelope.data as T;
  } catch (error) {
    if (error instanceof AiRequestError) throw error;
    if (external?.aborted) throw error;
    if (timedOut) {
      throw new AiRequestError(-1, `请求超时（${Math.round(timeout / 1000)}s），请稍后重试`);
    }
    throw new AiRequestError(-1, "网络请求失败，请检查网络后重试");
  } finally {
    if (timer !== null) window.clearTimeout(timer);
    external?.removeEventListener("abort", abort);
  }
}

export async function aiUpload(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return aiRequest<UploadResult>("/uploads", {
    method: "POST",
    body: form,
    timeout: AI_TIMEOUTS.upload,
  });
}
