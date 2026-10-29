type TokenGetter = () => string | null;

let getter: TokenGetter = () => {
  try {
    return sessionStorage.getItem("ic:ai-token");
  } catch {
    return null;
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
