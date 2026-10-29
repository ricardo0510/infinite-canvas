const ENV_API_BASE = import.meta.env.VITE_AI_API_BASE_URL ?? "";
const ENV_REALTIME_BASE = import.meta.env.VITE_AI_REALTIME_BASE_URL ?? "";
const ENV_MOCK = import.meta.env.VITE_AI_MOCK === "1";

function devDefaultApiBase(): string {
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") return "";
  return "/v1";
}

function deriveRealtimeBase(apiBase: string): string {
  if (!apiBase) return "";
  if (apiBase.startsWith("/")) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }
  try {
    const url = new URL(apiBase);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const path = url.pathname.replace(/\/v1\/?$/, "");
    return `${protocol}//${url.host}${path}`;
  } catch {
    return "";
  }
}

export const AI_TIMEOUTS = {
  request: 30_000,
  upload: 300_000,
  task: 30 * 60 * 1000,
};

function sessionValue(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function trimBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getAiApiBase(): string {
  return trimBase(ENV_API_BASE || sessionValue("ic:ai-api-base") || devDefaultApiBase());
}

export function getAiRealtimeBase(): string {
  return trimBase(
    ENV_REALTIME_BASE ||
      sessionValue("ic:ai-realtime-base") ||
      deriveRealtimeBase(getAiApiBase()),
  );
}

export function isAiMock(): boolean {
  return ENV_MOCK || !getAiApiBase();
}

export function setAiRuntimeConfig(input: {
  apiBase?: string;
  realtimeBase?: string;
  token?: string;
}): void {
  try {
    if (input.apiBase !== undefined) {
      const value = trimBase(input.apiBase);
      if (value) sessionStorage.setItem("ic:ai-api-base", value);
      else sessionStorage.removeItem("ic:ai-api-base");
    }
    if (input.realtimeBase !== undefined) {
      const value = trimBase(input.realtimeBase);
      if (value) sessionStorage.setItem("ic:ai-realtime-base", value);
      else sessionStorage.removeItem("ic:ai-realtime-base");
    }
    if (input.token !== undefined) {
      if (input.token) sessionStorage.setItem("ic:ai-token", input.token);
      else sessionStorage.removeItem("ic:ai-token");
    }
  } catch {
    // Session storage can be unavailable in hardened browsers.
  }
}
