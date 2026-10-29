type TokenGetter = () => string | null;

const ENV_TOKEN = import.meta.env.VITE_AI_TOKEN ?? "";

let getter: TokenGetter = () => {
  try {
    return sessionStorage.getItem("ic:ai-token") ?? (ENV_TOKEN || null);
  } catch {
    return ENV_TOKEN || null;
  }
};

let unauthorizedHandler: (() => void) | null = null;

export function setAiTokenProvider(fn: TokenGetter): void {
  getter = fn;
}

export function getAiToken(): string | null {
  return getter();
}

export function setAiUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyAiUnauthorized(): void {
  unauthorizedHandler?.();
}
