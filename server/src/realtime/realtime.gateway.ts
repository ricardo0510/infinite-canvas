import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { Server } from "node:http";
import type { Duplex } from "node:stream";
import type { Subscription } from "rxjs";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { TaskEvents } from "../tasks/task.events";
import { TasksService } from "../tasks/tasks.service";
import { toPublicTask, type InternalTask } from "../tasks/task.types";
import { RealtimeService } from "./realtime.service";

type ClientState = {
  userId: string;
  taskIds: Set<string>;
};

type IncomingMessage = {
  type: string;
  data?: unknown;
};

@Injectable()
export class RealtimeGateway implements OnModuleInit, OnModuleDestroy {
  private readonly clients = new Map<WebSocket, ClientState>();
  private readonly subscriptions = new Map<WebSocket, () => void>();
  private wss: WebSocketServer | null = null;
  private upgradeHandler:
    | ((request: import("node:http").IncomingMessage, socket: Duplex, head: Buffer) => void)
    | null = null;
  private eventSubscription: Subscription | null = null;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly realtime: RealtimeService,
    private readonly tasks: TasksService,
    private readonly events: TaskEvents,
  ) {}

  onModuleInit(): void {
    this.eventSubscription = this.events.updated$.subscribe((task) => {
      this.broadcast(task);
    });

    const server = this.adapterHost.httpAdapter?.getHttpServer() as Server | undefined;
    if (!server) return;

    this.wss = new WebSocketServer({ noServer: true });
    this.upgradeHandler = (request, socket, head) => {
      const url = new URL(request.url ?? "", "http://localhost");
      if (url.pathname !== "/v1/realtime") return;

      try {
        const userId = this.realtime.consume(url.searchParams.get("ticket"));
        this.wss?.handleUpgrade(request, socket, head, (client) => {
          this.attach(client, userId);
        });
      } catch {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
      }
    };
    server.on("upgrade", this.upgradeHandler);
  }

  onModuleDestroy(): void {
    this.eventSubscription?.unsubscribe();
    for (const close of this.subscriptions.values()) close();
    this.subscriptions.clear();
    this.clients.clear();
    this.wss?.close();
    const server = this.adapterHost.httpAdapter?.getHttpServer() as Server | undefined;
    if (server && this.upgradeHandler) server.off("upgrade", this.upgradeHandler);
  }

  private attach(client: WebSocket, userId: string): void {
    this.clients.set(client, { userId, taskIds: new Set() });

    const onMessage = (raw: RawData) => {
      this.handleMessage(client, userId, raw.toString());
    };
    const onClose = () => {
      this.clients.delete(client);
    };

    client.on("message", onMessage);
    client.on("close", onClose);
    client.on("error", onClose);
    this.subscriptions.set(client, () => {
      client.off("message", onMessage);
      client.off("close", onClose);
      client.off("error", onClose);
    });
  }

  private handleMessage(client: WebSocket, userId: string, raw: string): void {
    let message: IncomingMessage;
    try {
      message = JSON.parse(raw) as IncomingMessage;
    } catch {
      return;
    }
    if (!message || typeof message.type !== "string") return;

    if (message.type === "ping") {
      this.send(client, { type: "pong", data: null });
      return;
    }

    const state = this.clients.get(client);
    if (!state) return;

    if (message.type === "subscribe") {
      const data = message.data as { taskIds?: unknown } | undefined;
      const ids = Array.isArray(data?.taskIds)
        ? data.taskIds.filter((id): id is string => typeof id === "string")
        : [];
      for (const taskId of ids) {
        const task = this.tasks.find(userId, taskId);
        if (!task) continue;
        state.taskIds.add(taskId);
        this.send(client, { type: "task.updated", data: { task } });
      }
      return;
    }

    if (message.type === "unsubscribe") {
      const data = message.data as { taskIds?: unknown } | undefined;
      if (Array.isArray(data?.taskIds)) {
        for (const id of data.taskIds) {
          if (typeof id === "string") state.taskIds.delete(id);
        }
      }
      return;
    }

    this.send(client, {
      type: "error",
      data: { code: 20001, message: "未知消息类型" },
    });
  }

  private broadcast(task: InternalTask): void {
    const publicTask = toPublicTask(task);
    for (const [client, state] of this.clients) {
      if (!state.taskIds.has(task.taskId)) continue;
      this.send(client, { type: "task.updated", data: { task: publicTask } });
      if (task.status === "succeeded" || task.status === "failed" || task.status === "canceled") {
        state.taskIds.delete(task.taskId);
      }
    }
  }

  private send(client: WebSocket, payload: unknown): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }
}
