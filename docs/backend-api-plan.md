# Infinite Canvas 后端方案与 API 文档

> 对齐版本：前端 schema v5，代码位于 `src/lib/ai/*`  
> 关联文档：`docs/ai-generation-development-plan.md`  
> 本文同时包含「后端实现方案」和「接口文档」，以后端实现者视角编写。  
> 当前仓库已有 `server/` 骨架：NestJS + Fastify + Prisma/PostgreSQL 任务持久化 + Redis/BullMQ 任务队列 + Mock Provider + 本地磁盘上传；实时票据仍在内存，S3/真实 Provider 尚未接入。

---

## 0. 结论摘要

- 推荐技术栈：**Node.js 22 + TypeScript + NestJS（Fastify adapter）+ PostgreSQL + Prisma + Redis + BullMQ + S3 兼容存储 + 原生 WebSocket**。
- 文本、图片、视频统一使用**异步任务 + WebSocket 推送**；不提供 HTTP 轮询兜底。
- 所有 HTTP 响应统一 `{ code, message, data }`；`code === 0` 表示成功。
- 先做「模型目录、上传、任务提交（文本/图片）、任务查询、取消、实时票据」，再做「视频任务、限流、积分、审核、可观测性」。
- WebSocket 是任务结果的唯一推送通道；`GET /tasks/{id}` 仅用于手动刷新、调试和排障，客户端不轮询。
- 有一批**前端契约细节**必须在实现时遵守，见 §11.12，尤其是任务结果项必须包含 `kind`、`modelId`、`createdAt`，且不要返回 `304`。

---

## 1. 范围与目标

### 1.1 本期范围

- 模型目录：按 `text` / `image` / `video` 返回可用模型与参数能力。
- 文件上传：图片上传并返回可被生成服务访问的 URL；视频上传接口预留。
- 文本生成：异步任务，返回 `taskId`，结果通过 WebSocket 推送；不做 SSE、不做逐字输出。
- 图片生成：异步任务，返回 `taskId`，支持查询、取消、实时推送。
- 视频生成：异步任务，支持文生视频、图生视频、首尾帧、参考视频。
- 任务状态：`queued` / `running` / `succeeded` / `failed` / `canceled`。
- 幂等：`clientRequestId` 24 小时去重。
- 鉴权：Bearer Token；WebSocket 使用一次性 ticket。
- 失败语义：统一错误码、可直接展示的错误文案、请求追踪 ID。

### 1.2 不在本期范围

- 画布数据、节点、连线的服务端存储（继续本地优先）。
- 聊天会话、上下文记忆、流式文本。
- 多租户计费系统（先预留字段与接口边界）。
- 内容审核平台自建（先接第三方或提供策略接口）。

---

## 2. 总体架构

```text
Browser
  │  HTTPS / JSON / multipart            WSS
  ▼                                      ▼
API Service ────────────────┐      Realtime Gateway
  │                         │            │
  │ Prisma                   │            │ Redis Pub/Sub
  ▼                         │            ▼
PostgreSQL                  │         Redis
  ▲                         │            ▲
  │                         │            │
Worker Pool ────────────────┘────────────┘
  │
  ├── Provider Adapter（文本）
  ├── Provider Adapter（图片）
  ├── Provider Adapter（视频）
  └── S3 / OSS / MinIO
```

### 2.1 服务拆分

| 服务 | 职责 |
| --- | --- |
| API | 鉴权、参数校验、模型目录、上传、提交任务、任务查询/取消、签发实时票据 |
| Worker | 消费队列、调用上游模型、轮询上游任务、写结果、发事件 |
| Realtime Gateway | 校验 ticket、维护订阅、把任务事件推给浏览器 |
| PostgreSQL | 用户、模型、上传、生成记录、任务、幂等键、票据 |
| Redis | BullMQ 队列、任务进度缓存、Pub/Sub、限流计数 |
| 对象存储 | 参考图/视频、生成结果、缩略图 |

API 与 Realtime Gateway 都无状态，可水平扩容；Worker 按队列并发扩容。

---

## 3. 技术选型

### 3.1 推荐栈

| 层 | 选择 | 原因 |
| --- | --- | --- |
| 语言 | TypeScript / Node.js 22 | 与前端同语言，模型/任务类型可共享 |
| Web 框架 | NestJS + Fastify adapter | 模块化、DI、校验、OpenAPI、WebSocket Gateway |
| 校验 | Zod 或 class-validator | 请求体、参数、模型能力校验 |
| ORM | Prisma | schema 清晰，迁移方便 |
| 数据库 | PostgreSQL 16 | JSONB 存模型能力/结果，事务可靠 |
| 队列 | BullMQ + Redis | 重试、延迟、并发、限流、取消 |
| 实时 | 原生 `ws` / NestJS WsAdapter | 前端使用原生 `WebSocket`，不要用 Socket.IO 协议 |
| 存储 | S3 / OSS / MinIO | 预签名 URL、生命周期清理 |
| 文档 | OpenAPI 3.1 | 可由 NestJS 装饰器生成，也可手写 |

### 3.2 备选栈

FastAPI（Python）或 Go 同样可行，接口契约不变。若要复用前端类型，Node/TS 成本最低。

---

## 4. 数据模型

> 以下是推荐最小模型，字段名可按团队规范调整；API 字段必须保持 camelCase。

### 4.1 users

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| externalId | text | 外部账号 ID，可空 |
| status | text | active / disabled |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

### 4.2 api_tokens

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid | 主键 |
| userId | uuid | 所属用户 |
| tokenHash | text | 只存哈希，不存明文 |
| name | text | 令牌名称 |
| expiresAt | timestamptz | 可空 |
| lastUsedAt | timestamptz | 可空 |
| createdAt | timestamptz | |

### 4.3 models

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 对外模型 ID，主键 |
| name | text | 展示名 |
| kind | text | text / image / video |
| modes | jsonb | 能力数组 |
| description | text | 可空 |
| logoUrl | text | 可空 |
| limits | jsonb | maxPromptLength / maxImages / maxVideos |
| output | jsonb | image/video 能力 |
| params | jsonb | qualityTiers / backgrounds / extra |
| pricing | jsonb | 可空 |
| provider | text | 适配器标识 |
| providerModel | text | 上游模型 ID |
| enabled | boolean | 是否对用户可见 |
| createdAt / updatedAt | timestamptz | |

`models` 建议由配置或管理后台维护，不要写死在代码里；返回给前端时按 `enabled` 和用户权限过滤。

### 4.4 uploads

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | `upl_...` |
| userId | uuid | 所属用户 |
| storageKey | text | 对象存储 key |
| url | text | 可访问 URL |
| thumbnailUrl | text | 可空 |
| mimeType | text | |
| size | bigint | 字节 |
| width / height | int | 可空 |
| sha256 | text | 去重/审计 |
| assetId | text | 可空，内容身份 |
| expiresAt | timestamptz | 可空 |
| createdAt | timestamptz | |

### 4.5 tasks

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | `task_...` |
| userId | uuid | |
| kind | text | text / image / video |
| modelId | text | |
| mode | text | |
| request | jsonb | 归一化后的请求，便于重放/审计 |
| status | text | queued / running / succeeded / failed / canceled |
| progress | int | 0–100，可空 |
| provider | text | |
| providerTaskId | text | 上游任务 ID |
| result | jsonb | 成功结果，结构见 API |
| error | jsonb | `{ code, message }` |
| clientRequestId | text | 幂等键 |
| cancelRequestedAt | timestamptz | 可空 |
| startedAt / completedAt | timestamptz | 可空 |
| createdAt / updatedAt | timestamptz | |
| expiresAt | timestamptz | 结果过期时间 |

索引建议：

- `(userId, clientRequestId, kind)` 唯一或部分唯一。
- `(userId, createdAt desc)` 任务列表/审计。
- `(status, updatedAt)` Worker 扫描/补偿。
- `(provider, providerTaskId)` 上游回调/轮询映射。

### 4.6 task_events（可选）

用于审计、重放和排查：`taskId`、`status`、`progress`、`payload`、`createdAt`。不是必须，但强烈建议保留终态与错误事件。

### 4.7 idempotency_keys

> 当前骨架直接使用 `tasks` 的 `(userId, kind, clientRequestId)` 唯一约束承担幂等；以下独立表用于后续拆分。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| userId | uuid | |
| scope | text | text / image / video |
| key | text | clientRequestId 哈希 |
| resourceType | text | task |
| resourceId | text | |
| expiresAt | timestamptz | 建议 24h |

### 4.8 realtime_tickets

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | `rt_...` |
| userId | uuid | |
| expiresAt | timestamptz | 60s |
| usedAt | timestamptz | 一次性使用 |
| createdAt | timestamptz | |

### 4.9 credit_ledger（预留）

`userId`、`delta`、`reason`、`refType`、`refId`、`balanceAfter`、`createdAt`。本期可以先不启用，但接口层保留扣费/退款位置。

---

## 5. 关键流程

### 5.1 模型列表

1. 校验 token（生产环境）。
2. 查询 `models.enabled = true`，按用户权限过滤。
3. 返回完整模型对象；前端会自己按 `kind` 过滤。
4. 缓存 60 秒；可加 `ETag`，但**不要返回 304**（见 §11.12）。

### 5.2 上传

1. 接收 `multipart/form-data` 的 `file` 字段。
2. 校验大小、MIME、magic bytes；图片解码宽高；视频读取元数据（可选）。
3. 计算 sha256；同用户同哈希可复用已有上传。
4. 写入对象存储；生成可访问 URL/预签名 URL。
5. 写入 `uploads`，返回 `uploadId/url/mimeType/size/width/height/assetId`。
6. 本地图片上传后，前端会把 `url` 放进 `references`；后端必须保证该 URL 可被 Provider 访问。

### 5.3 文本任务

1. 校验 `modelId` 属于 `kind=text` 且用户有权使用。
2. 校验 `prompt` 长度、`params.temperature`、`maxOutputTokens`。
3. 幂等检查：同 `clientRequestId` 返回已有任务（HTTP 200）。
4. 写入 `tasks`（`kind=text`、`queued`），写入幂等键，投递 BullMQ。
5. 立即返回 `202` + `{ taskId, status, createdAt }`。
6. Worker 调用文本 Provider，成功后写入 `result`：
   ```json
   {
     "kind": "text",
     "items": [
       {
         "id": "item_1",
         "kind": "text",
         "text": "生成结果",
         "modelId": "gpt-4-1-mini",
         "createdAt": "2026-10-29T08:00:12Z",
         "usage": { "inputTokens": 120, "outputTokens": 80 },
         "finishReason": "stop"
       }
     ]
   }
   ```
7. 通过 WebSocket 推送终态；失败返回业务错误码，不返回上游堆栈。

### 5.4 图片/视频任务

1. 校验模型、模式、references、params。
2. 幂等检查：同 `clientRequestId` 返回已有任务（HTTP 200，不是 202）。
3. 写入 `tasks`（`queued`），写入幂等键，投递 BullMQ。
4. 立即返回 `202` + `{ taskId, status, createdAt }`。
5. Worker 取任务，设置 `running`，调用 Provider 提交，保存 `providerTaskId`。
6. Worker 轮询上游或接收 Provider 回调，更新 `progress/status/result/error`；这里指上游 Provider，不是客户端。
7. 每次状态/进度变化写 Redis Pub/Sub，Realtime Gateway 推送 `task.updated`。
8. 终态写完整 `result` 或 `error`；发终态事件；按 TTL 清理。

### 5.5 取消

1. 校验任务归属。
2. 已终态返回 `20005`。
3. 标记 `cancelRequestedAt`，调用 Provider 取消；若 Provider 不支持，直接本地标记 `canceled`。
4. 返回最新任务对象。

### 5.6 实时推送

- WebSocket 是任务结果的唯一推送通道；客户端不轮询。
- 客户端在提交任务后订阅 `taskId`；服务端在收到 `subscribe` 时**立即推送每个任务的当前快照**，然后推送后续变化。
- 断线重连后客户端会重新订阅；服务端再次返回当前快照，因此不需要 HTTP 轮询补偿。
- `GET /v1/tasks/{taskId}` 仅用于手动刷新、调试和排障，不作为高频兜底。
- 进度更新建议节流到 1 秒一次；终态必须立即推送。
- WebSocket 不可用时，任务会等待到超时并失败，不会降级为轮询。

### 5.7 幂等

- `clientRequestId` 视为不透明字符串（前端格式是 `nodeId:uuid`，但后端不要解析）。
- 作用域：`userId + kind + clientRequestId`。
- 文本、图片、视频统一返回已有任务，HTTP 200。
- 保留 24 小时；过期后允许重新创建。

### 5.8 结果过期与清理

- 任务结果 URL 建议 30 天有效；`expiresAt` 返回给前端。
- 任务记录保留 90 天；上传资源按业务策略清理。
- Worker 定时扫描超过 30 分钟仍非终态的任务，标记 `failed`，错误码建议 `30002`（上游超时）。

---

## 6. Provider 适配

### 6.1 适配器接口

```ts
type SubmitInput = {
  model: ProviderModel;
  mode: string;
  prompt: string;
  negativePrompt?: string;
  references: ReferenceInput[];
  params: Record<string, unknown>;
};

type ProviderAdapter = {
  submit(input: SubmitInput): Promise<{ providerTaskId: string }>;
  poll(providerTaskId: string): Promise<{
    status: "queued" | "running" | "succeeded" | "failed";
    progress?: number;
    result?: NormalizedResult;
    error?: { code: number; message: string };
  }>;
  cancel?(providerTaskId: string): Promise<void>;
};
```

`NormalizedResult` 必须直接产出前端可用的结果项，包含 `kind`、`url`、`thumbnailUrl`、`width`、`height`、`duration`、`assetId`、`modelId`、`createdAt`。

### 6.2 模型与 Provider 解耦

- `models.provider` + `models.providerModel` 决定路由。
- 新增模型只加配置，不改 API。
- 每个 Provider 有独立并发限制与速率限制；BullMQ 按 Provider 分队列或使用 limiter。
- Provider 错误映射到统一业务码，见 §11.2。

### 6.3 重试策略

- 提交失败：指数退避重试 3 次；幂等键保证不重复创建。
- Worker 轮询上游失败：连续 5 次失败标记任务失败；这是 Worker 对 Provider 的轮询，不是客户端轮询。
- 上游明确返回不可重试错误（内容审核、参数错误）时不要重试。

### 6.4 内容审核

- 文本：提交前/后调用审核；命中返回 `20003`。
- 图片/视频：至少校验 prompt 与参考图；结果可异步抽检。
- 审核记录单独表或日志，便于申诉。

---

## 7. 安全与运维

### 7.1 鉴权

- 所有 HTTP 接口使用 `Authorization: Bearer <token>`。
- 生产环境必须鉴权；本地开发可通过环境变量允许匿名，方便前端联调。
- WebSocket 不直接带 JWT，使用一次性 ticket。

### 7.2 CORS

允许前端域名、`Authorization`、`Content-Type`、`X-Request-Id`；WebSocket 校验 `Origin`。

### 7.3 上传安全

- 限制大小：图片 20MB，视频 200MB（可按业务调整）。
- 校验 magic bytes，不只信 `Content-Type`。
- 图片解码失败直接拒绝；防止 SVG/HTML 伪装。
- 对象存储桶默认私有，通过签名 URL 或 CDN 访问。
- 文件名不落盘；使用随机 key。

### 7.4 SSRF 与引用 URL

- `references[].url` 只允许 `https:`；生产环境建议只允许自有 CDN 域名或已上传资源。
- 禁止 `localhost`、内网 IP、非 80/443 端口。
- 若允许外部 URL，解析 DNS 后校验 IP 段。

### 7.5 限流

- 按用户 + IP 双维度。
- 生成、上传、模型列表分别限流。
- 超限返回 `429` + `Retry-After`。

### 7.6 可观测性

- 每个请求生成 `X-Request-Id`，贯穿 API → Worker → Provider。
- 结构化日志：userId、route、modelId、taskId、provider、耗时、错误码。
- 指标：QPS、P95 延迟、任务成功率、队列积压、Provider 错误率、单任务成本。
- 追踪：OpenTelemetry（可选）。

### 7.7 部署

```text
docker-compose (dev)
  api
  worker
  postgres
  redis
  minio
  caddy/nginx
```

生产：API/Worker/Realtime 分别部署；Worker 按队列扩容；Realtime 通过 Redis Pub/Sub 广播，无需 sticky session。

环境变量建议：

```text
DATABASE_URL
REDIS_URL
S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY
PUBLIC_BASE_URL
CORS_ORIGINS
JWT_SECRET / TOKEN_PEPPER
PROVIDER_*_API_KEY
DEV_ALLOW_ANONYMOUS
```

---

## 8. 实施计划

| 阶段 | 内容 | 预估 |
| --- | --- | --- |
| M0 | OpenAPI/契约、Mock 数据、错误码、环境变量 | 1–2 天 |
| M1 | 鉴权、模型列表、上传 | 2–3 天 |
| M2 | 文本任务 + 幂等 + WebSocket 终态 | 1–2 天 |
| M3 | 图片任务 + BullMQ + 查询 + 取消 | 3–5 天 |
| M4 | 视频任务 + 首尾帧/参考视频校验 | 3–5 天 |
| M5 | WebSocket ticket + 订阅快照 + 实时推送 | 2–3 天 |
| M6 | 限流、审核、积分预留、监控、压测 | 2–3 天 |

单人全职约 3–4 周；可与前端 Mock 并行，先交付 M0/M1 让联调跑起来。

---

## 9. 测试计划

- 契约测试：用前端 `payload.ts` 生成的请求体做 fixture，验证响应字段。
- 文本任务测试：`POST /text/generations` 返回 202，终态结果项包含 `kind/modelId/createdAt/text`。
- 状态机测试：queued → running → succeeded/failed/canceled，非法转换返回 20005。
- 幂等测试：并发相同 `clientRequestId` 只创建一个任务；24 小时后可重建。
- 上传测试：大小、MIME、伪装文件、损坏图片、重复哈希。
- 实时测试：ticket 过期/复用、订阅越权、subscribe 立即回快照、断线重连后重新订阅、终态事件不丢。
- 故障注入：Provider 超时、429、5xx、返回空结果、取消后仍回调、WS 断开。
- 压测：任务提交 QPS、Worker 并发、WS 连接数、Redis 积压。

---

## 10. 待确认

1. 账号体系：沿用现有 JWT，还是新建 API Token？
2. Provider 选型：文本/图片/视频分别接哪家？是否需要多云路由？
3. 存储：S3、OSS、MinIO 还是自建 CDN？
4. 是否需要积分/计费？如果要，扣费是在提交时还是终态时？
5. 内容审核策略与合规要求。
6. 视频上传是否本期支持？前端目前只支持本地图片上传。
7. 结果保留时长与成本预算。

---

# 11. API 文档

## 11.1 通用约定

| 项 | 约定 |
| --- | --- |
| Base URL | `https://{host}/v1`，前端通过 `VITE_AI_API_BASE_URL` 配置，末尾不要带 `/` |
| 鉴权 | `Authorization: Bearer <token>` |
| JSON | `Content-Type: application/json` |
| 上传 | `multipart/form-data`，字段名 `file` |
| 字段命名 | camelCase |
| 时间 | ISO 8601 UTC，例如 `2026-10-29T08:00:00Z` |
| ID | 不透明字符串；前端不解析 |
| 成功响应 | `{ "code": 0, "message": "ok", "data": ... }` |
| 失败响应 | `{ "code": 非0, "message": "可展示文案", "data": ... }` |
| 追踪 | 响应头 `X-Request-Id` |
| 限流 | `429` + `Retry-After` 秒数 |
| 幂等 | 生成接口带 `clientRequestId`，24h 去重 |

### 11.1.1 成功/失败示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "taskId": "task_123",
    "status": "queued",
    "createdAt": "2026-10-29T08:00:00Z"
  }
}
```

```json
{
  "code": 20001,
  "message": "params.duration 超出模型允许范围",
  "data": {
    "field": "params.duration",
    "min": 4,
    "max": 12
  }
}
```

## 11.2 鉴权与错误码

### 11.2.1 鉴权失败

HTTP `401`：

```json
{ "code": 10001, "message": "登录已过期，请重新登录", "data": null }
```

### 11.2.2 业务码

| code | HTTP | 含义 |
| --- | --- | --- |
| 0 | 200/201/202 | 成功 |
| 10001 | 401 | 未登录 / token 过期 |
| 10003 | 403 | 无权限 / 模型未开通 |
| 10004 | 404 | 模型、任务或记录不存在 |
| 10005 | 429 | 频率限制 |
| 10007 | 401 | 实时票据过期/无效 |
| 20001 | 422 | 参数校验失败 |
| 20002 | 402 | 积分不足 |
| 20003 | 422 | 内容审核不通过 |
| 20004 | 503 | 模型暂不可用 |
| 20005 | 409 | 任务已终态，不能重复操作 |
| 20006 | 409 | 相同请求正在进行 |
| 30001 | 502 | 上游模型失败 |
| 30002 | 504 | 上游任务超时 |
| 50000 | 500 | 服务端内部错误 |

前端只判断 `code === 0`；错误码用于提示和埋点，不直接展示数字。

## 11.3 模型列表

```http
GET /v1/models
GET /v1/models?kind=image
Authorization: Bearer <token>
```

`kind` 可省略；前端通常不传，取全部后自行过滤。

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "models": [
      {
        "id": "flux-1-1-pro",
        "name": "Flux 1.1 Pro",
        "kind": "image",
        "modes": ["textToImage", "imageToImage"],
        "description": "高质量图像生成",
        "logoUrl": "https://cdn.example.com/models/flux.png",
        "limits": { "maxPromptLength": 2000, "maxImages": 4, "maxVideos": 0 },
        "output": {
          "image": {
            "aspectRatios": ["1:1", "4:3", "16:9"],
            "resolutions": ["1k", "2k", "4k"],
            "maxCount": 4
          },
          "video": null
        },
        "params": {
          "qualityTiers": [
            { "key": "standard", "label": "标准" },
            { "key": "high", "label": "高画质" }
          ],
          "backgrounds": ["opaque", "transparent", "auto"],
          "extra": [
            {
              "key": "style",
              "label": "风格",
              "type": "select",
              "defaultValue": "realistic",
              "options": [
                { "label": "写实", "value": "realistic" },
                { "label": "动画", "value": "anime" }
              ]
            }
          ]
        },
        "pricing": { "baseCredits": 10 }
      },
      {
        "id": "seedance-1-0-pro",
        "name": "Seedance 1.0 Pro",
        "kind": "video",
        "modes": ["textToVideo", "imageToVideo", "firstLastFrame", "referenceVideo"],
        "description": "支持文生视频、图生视频与首尾帧",
        "limits": { "maxPromptLength": 2000, "maxImages": 2, "maxVideos": 1 },
        "output": {
          "image": null,
          "video": {
            "aspectRatios": ["16:9", "9:16", "1:1"],
            "resolutions": ["480p", "720p", "1080p"],
            "minDuration": 4,
            "maxDuration": 12,
            "supportsAudio": true
          }
        }
      }
    ]
  }
}
```

字段规则：

- `id` 是请求中的 `modelId`。
- `kind`：`text` / `image` / `video`。
- `modes`：图片 `textToImage` / `imageToImage`；视频 `textToVideo` / `imageToVideo` / `firstLastFrame` / `referenceVideo`；文本可为空数组。
- `limits` 必填。
- `output.image`、`output.video` 必须存在，二者至少一个非空。
- `params.extra[].type` 建议只用 `select`；前端目前按下拉框渲染。
- `pricing` 可选，只用于展示。

## 11.4 文件上传

```http
POST /v1/uploads
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=<binary>
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "uploadId": "upl_123",
    "url": "https://cdn.example.com/upl/123.png",
    "thumbnailUrl": null,
    "mimeType": "image/png",
    "size": 245678,
    "width": 1024,
    "height": 1024,
    "assetId": "asset_123"
  }
}
```

规则：

- `file` 必填。
- 图片建议最大 20MB；前端本地图片限制更小（约 4MB）。
- 图片必须可被生成服务读取。
- `width` / `height` 对图片必填；视频可选。
- `assetId` 可选。
- 本期前端只会上传图片；视频上传接口可先预留。

## 11.5 文本生成

```http
POST /v1/text/generations
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "modelId": "gpt-4-1-mini",
  "prompt": "把下面的需求整理成三个要点：...",
  "systemPrompt": "你是一个严谨的产品经理。",
  "params": {
    "temperature": 0.7,
    "maxOutputTokens": 2000
  },
  "clientRequestId": "node-abc:req-01J..."
}
```

字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| modelId | 是 | 文本模型 |
| prompt | 是 | 用户提示词 |
| systemPrompt | 否 | 系统提示词 |
| params.temperature | 否 | 0–2 |
| params.maxOutputTokens | 否 | 最大输出 token |
| clientRequestId | 是 | 幂等键，20–128 字符 |

响应 `202`：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "taskId": "task_text_123",
    "status": "queued",
    "createdAt": "2026-10-29T08:00:00Z"
  }
}
```

文本结果通过 `GET /v1/tasks/{taskId}` 或 WebSocket `task.updated` 返回，任务结构：

```json
{
  "taskId": "task_text_123",
  "kind": "text",
  "status": "succeeded",
  "progress": 100,
  "modelId": "gpt-4-1-mini",
  "mode": "",
  "result": {
    "kind": "text",
    "items": [
      {
        "id": "item_1",
        "kind": "text",
        "text": "第一点，明确目标。\n第二点，拆解路径。\n第三点，定义验收标准。",
        "modelId": "gpt-4-1-mini",
        "createdAt": "2026-10-29T08:00:12Z",
        "usage": { "inputTokens": 120, "outputTokens": 80 },
        "finishReason": "stop"
      }
    ]
  },
  "error": null,
  "createdAt": "2026-10-29T08:00:00Z",
  "updatedAt": "2026-10-29T08:00:12Z"
}
```

规则：

- 异步任务，不使用 SSE，不做逐字输出。
- 提交后通过 WebSocket 推送；客户端不轮询。
- 相同 `clientRequestId` 返回已有任务，HTTP `200`。
- `result.items[]` 必须包含 `kind: "text"`、`modelId`、`createdAt`；`usage`、`finishReason` 可选。
- 失败时 `result=null`，`error` 非空；前端保留旧文本并显示错误。

## 11.6 图片生成

```http
POST /v1/image/generations
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "modelId": "flux-1-1-pro",
  "mode": "imageToImage",
  "prompt": "保持构图，改成雨夜霓虹风格",
  "negativePrompt": "低清晰度，文字水印",
  "references": [
    { "type": "reference", "url": "https://cdn.example.com/upl/123.png", "assetId": "asset_123" }
  ],
  "params": {
    "aspectRatio": "1:1",
    "resolution": "1k",
    "count": 1,
    "qualityTier": "high",
    "background": "opaque",
    "watermark": true,
    "seed": 0,
    "extra": { "style": "realistic" }
  },
  "clientRequestId": "node-abc:req-01J..."
}
```

校验：

- `mode`：`textToImage` / `imageToImage`。
- `imageToImage` 至少 1 个 `reference`。
- `references[].type` 图片只允许 `reference`。
- `params.count` 收敛到模型 `output.image.maxCount`。
- `params.resolution` 必须在模型 `resolutions` 中。
- `params.qualityTier` / `background` 仅在模型声明时允许；不传时用默认值。

响应 `202`：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "taskId": "task_123",
    "status": "queued",
    "createdAt": "2026-10-29T08:00:00Z"
  }
}
```

相同 `clientRequestId` 已存在时返回 HTTP `200`，`data` 相同。

## 11.7 视频生成

```http
POST /v1/video/generations
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "modelId": "seedance-1-0-pro",
  "mode": "firstLastFrame",
  "prompt": "镜头缓慢推进，霓虹灯反射在地面",
  "negativePrompt": "模糊，抖动",
  "references": [
    { "type": "firstFrame", "url": "https://cdn.example.com/upl/start.png" },
    { "type": "lastFrame", "url": "https://cdn.example.com/upl/end.png" }
  ],
  "params": {
    "aspectRatio": "16:9",
    "resolution": "720p",
    "duration": 5,
    "generateAudio": true,
    "watermark": true,
    "seed": 0,
    "extra": {}
  },
  "clientRequestId": "node-abc:req-01J..."
}
```

模式与引用：

| mode | references 规则 |
| --- | --- |
| textToVideo | 不允许图片/视频引用 |
| imageToVideo | 至少 1 个 `referenceImage`，不允许首尾帧 |
| firstLastFrame | 恰好 1 个 `firstFrame` + 1 个 `lastFrame` |
| referenceVideo | 至少 1 个 `referenceVideo`，可带 `referenceImage` |

其他校验：

- `params.duration` 在 `minDuration`–`maxDuration` 内。
- `params.generateAudio` 仅在 `output.video.supportsAudio=true` 时生效；前端默认可能传 `false`，**不要因为模型不支持音频而拒绝 `false`**。
- `params.resolution` / `aspectRatio` 必须在模型能力内。
- `watermark` 默认 true。

响应 `202` 同图片生成。

## 11.8 查询任务

```http
GET /v1/tasks/{taskId}
Authorization: Bearer <token>
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "taskId": "task_123",
    "kind": "video",
    "status": "succeeded",
    "progress": 100,
    "modelId": "seedance-1-0-pro",
    "mode": "firstLastFrame",
    "result": {
      "kind": "video",
      "items": [
        {
          "id": "item_1",
          "kind": "video",
          "url": "https://cdn.example.com/out/video.mp4",
          "thumbnailUrl": "https://cdn.example.com/out/poster.jpg",
          "duration": 5,
          "width": 1280,
          "height": 720,
          "assetId": "asset_456",
          "modelId": "seedance-1-0-pro",
          "createdAt": "2026-10-29T08:00:40Z"
        }
      ]
    },
    "error": null,
    "createdAt": "2026-10-29T08:00:00Z",
    "updatedAt": "2026-10-29T08:00:40Z",
    "expiresAt": "2026-11-28T08:00:00Z"
  }
}
```

规则：

- `status`：`queued` / `running` / `succeeded` / `failed` / `canceled`。
- `kind`：`text` / `image` / `video`。
- `progress`：0–100，可省略。
- `result` 在非成功状态为 `null`。
- `result.kind` 与 `task.kind` 一致。
- **每个 `result.items[]` 必须包含 `kind`、`modelId`、`createdAt`**，否则前端会过滤掉结果。
- `failed` 时 `error` 非空，`result=null`。
- `canceled` 时 `result=null`，`error=null`。
- 终态后 `updatedAt` 不再变化。

图片结果示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "taskId": "task_789",
    "kind": "image",
    "status": "succeeded",
    "progress": 100,
    "modelId": "flux-1-1-pro",
    "mode": "textToImage",
    "result": {
      "kind": "image",
      "items": [
        {
          "id": "item_1",
          "kind": "image",
          "url": "https://cdn.example.com/out/a.png",
          "thumbnailUrl": "https://cdn.example.com/out/a_thumb.png",
          "width": 1024,
          "height": 1024,
          "assetId": "asset_789",
          "modelId": "flux-1-1-pro",
          "createdAt": "2026-10-29T08:00:20Z"
        }
      ]
    },
    "error": null,
    "createdAt": "2026-10-29T08:00:00Z",
    "updatedAt": "2026-10-29T08:00:20Z"
  }
}
```

## 11.9 取消任务

```http
POST /v1/tasks/{taskId}/cancel
Authorization: Bearer <token>
```

响应：返回最新任务对象，外层同 `{ code, message, data }`。已终态返回 `20005`。

## 11.10 获取实时票据

```http
POST /v1/realtime/tickets
Authorization: Bearer <token>
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "ticket": "rt_01J...",
    "expiresAt": "2026-10-29T08:01:00Z"
  }
}
```

规则：

- 一次性、60 秒有效。
- 不要把长期 token 放进 WebSocket URL。

## 11.11 WebSocket 实时通道

连接地址：

```text
wss://{realtimeHost}/v1/realtime?ticket=rt_01J...
```

> 前端实时 base 只填 `wss://host`，客户端会自己拼 `/v1/realtime`。不要配成 `wss://host/v1`。

客户端消息：

```json
{ "type": "subscribe", "data": { "taskIds": ["task_123", "task_456"] } }
{ "type": "unsubscribe", "data": { "taskIds": ["task_123"] } }
{ "type": "ping", "data": null }
```

服务端消息：

```json
{
  "type": "task.updated",
  "data": {
    "task": {
      "taskId": "task_123",
      "kind": "image",
      "status": "running",
      "progress": 42,
      "modelId": "flux-1-1-pro",
      "mode": "textToImage",
      "result": null,
      "error": null,
      "createdAt": "2026-10-29T08:00:00Z",
      "updatedAt": "2026-10-29T08:00:10Z"
    }
  }
}
```

```json
{ "type": "pong", "data": null }
```

```json
{ "type": "error", "data": { "code": 10007, "message": "票据已过期" } }
```

规则：

- `data.task` 必须与 `GET /v1/tasks/{taskId}` 的 `data` 完全一致。
- 终态事件带完整 `result` 或 `error`，客户端不再查询。
- 客户端每 20 秒 `ping`；50 秒未收到 `pong` 视为断线。
- 重连后客户端会重新订阅；服务端需允许重新订阅，并在收到 `subscribe` 时立即推送每个任务的当前快照。
- 进度事件可节流；终态事件不可丢。
- 订阅前校验任务归属，越权返回 `error`。

## 11.12 前端兼容性检查清单

实现后端时逐条对照，避免联调返工：

1. **`result.items[].kind` 必填**：前端按 `item.kind === node.kind` 过滤；缺失会报「任务成功但未返回结果」。
2. **`result.items[].modelId` / `createdAt` 必填**：前端结果类型需要；缺失虽能运行，但结果历史字段不完整。
3. **不要返回 304**：前端只处理 204 和 JSON；304 空响应会被判为格式异常。ETag 可以加，但仍返回 200 + JSON。
4. **文本也走异步任务**：`POST /v1/text/generations` 返回 `202` + `taskId`，不要在响应里直接返回文本。
5. **不要实现 HTTP 轮询兜底**：客户端只依赖 WebSocket；`GET /v1/tasks/{id}` 仅用于手动刷新、调试和排障。
6. **subscribe 必须立即回快照**：客户端订阅后不再轮询；服务端要在 `subscribe` 后立刻推送每个任务的当前 `task.updated`，断线重连后同样。
7. **WebSocket base 只填 host**：客户端会拼 `/v1/realtime`。
8. **接受 `watermark: true` 与 `generateAudio: false`**：前端默认参数可能包含它们，模型不支持音频时不要因为 `false` 拒绝。
9. **`GET /models` 无 `kind` 时返回全部**：前端会自行过滤。
10. **`clientRequestId` 当作不透明字符串**：不要解析 `nodeId:uuid`。
11. **错误必须是 JSON envelope**：代理返回 HTML 错误页会导致前端显示「服务响应格式异常」。
12. **CORS 允许 `Authorization`、`Content-Type`、`X-Request-Id`**。
13. **HTTP 状态与业务码同时正确**：前端用 `code` 判断业务失败，用 401 触发重新登录。
14. **任务结果 URL 必须可被浏览器访问**：生成结果不要只给内网地址。
15. **终态不可重复操作**：取消已终态任务返回 `20005`；重复查询应保持幂等。

---

## 12. 建议的交付物

- `openapi.yaml`：由本文章节生成，接入 Swagger UI。
- `docker-compose.yml`：api / worker / postgres / redis / minio。
- `.env.example`：数据库、Redis、S3、Provider、CORS。
- 迁移脚本与种子数据：至少 1 个文本、1 个图片、1 个视频模型。
- Contract test：使用前端 `buildTextBody/buildImageBody/buildVideoBody` 的输出作为 fixture。
- Mock 模式：后端未就绪时，前端继续使用现有 `mockProvider`。
