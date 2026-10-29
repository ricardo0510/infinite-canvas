import { getAiRealtimeBase } from "./config";
import { aiRequest } from "./http";

type RealtimeEnvelope = {
  type: string;
  data?: unknown;
};

type RealtimeHandler = (message: RealtimeEnvelope) => void;

let socket: WebSocket | null = null;
let connecting = false;
let reconnectTimer: number | null = null;
let attempts = 0;
let pingTimer: number | null = null;
let lastPong = 0;

const handlers = new Set<RealtimeHandler>();
const subscriptions = new Set<string>();

function send(message: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function sendSubscriptions(): void {
  if (subscriptions.size === 0) return;
  send({ type: "subscribe", data: { taskIds: [...subscriptions] } });
}

function stopTimers(): void {
  if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
  if (pingTimer !== null) window.clearInterval(pingTimer);
  reconnectTimer = null;
  pingTimer = null;
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null || !getAiRealtimeBase()) return;
  attempts += 1;
  const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5));
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    void connectRealtime();
  }, delay);
}

function startHeartbeat(): void {
  if (pingTimer !== null) window.clearInterval(pingTimer);
  lastPong = Date.now();
  pingTimer = window.setInterval(() => {
    if (Date.now() - lastPong > 50_000) {
      socket?.close();
      return;
    }
    send({ type: "ping", data: null });
  }, 20_000);
}

export async function connectRealtime(): Promise<void> {
  const base = getAiRealtimeBase();
  if (!base || connecting || socket?.readyState === WebSocket.OPEN) return;
  if (typeof WebSocket === "undefined") return;
  connecting = true;
  try {
    const data = await aiRequest<{ ticket: string }>("/realtime/tickets", { method: "POST" });
    const url = `${base.replace(/\/+$/, "")}/v1/realtime?ticket=${encodeURIComponent(data.ticket)}`;
    const next = new WebSocket(url);
    socket = next;
    next.onopen = () => {
      connecting = false;
      attempts = 0;
      startHeartbeat();
      sendSubscriptions();
    };
    next.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as RealtimeEnvelope;
        if (message.type === "pong") {
          lastPong = Date.now();
          return;
        }
        for (const handler of handlers) handler(message);
      } catch {
        // Ignore malformed frames.
      }
    };
    next.onclose = () => {
      connecting = false;
      if (socket === next) socket = null;
      if (pingTimer !== null) window.clearInterval(pingTimer);
      pingTimer = null;
      scheduleReconnect();
    };
    next.onerror = () => {
      next.close();
    };
  } catch {
    connecting = false;
    scheduleReconnect();
  }
}

export function onRealtimeMessage(handler: RealtimeHandler): () => void {
  handlers.add(handler);
  void connectRealtime();
  return () => {
    handlers.delete(handler);
  };
}

export function subscribeTasks(taskIds: string[]): void {
  let changed = false;
  for (const taskId of taskIds) {
    if (subscriptions.has(taskId)) continue;
    subscriptions.add(taskId);
    changed = true;
  }
  if (changed) sendSubscriptions();
}

export function unsubscribeTasks(taskIds: string[]): void {
  let changed = false;
  for (const taskId of taskIds) {
    if (!subscriptions.delete(taskId)) continue;
    changed = true;
  }
  if (changed) send({ type: "unsubscribe", data: { taskIds } });
}

export function closeRealtime(): void {
  stopTimers();
  socket?.close();
  socket = null;
  subscriptions.clear();
}
