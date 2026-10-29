# Infinite Canvas API

当前是可直接联调的后端骨架：

- NestJS + Fastify，统一 `{ code, message, data }` 响应。
- 模型目录、图片上传、文本/图片/视频异步任务、任务查询/取消、WebSocket 实时推送。
- 任务与幂等键持久化到 PostgreSQL（Prisma）；实时票据在内存，上传文件落本地磁盘。
- 文本模型支持 DeepSeek 4.1 Flash（OpenAI 兼容接口）；图片/视频生成待接入真实供应商。
- Redis + BullMQ 负责任务队列；`npm run dev` 默认在 API 进程内启动 Worker，生产可拆成独立 Worker 进程。

后续替换点：S3/OSS、图片/视频真实 Provider、生产鉴权与限流。

## DeepSeek 4.1 Flash

在 `.env` 中配置：

```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_TIMEOUT_MS=120000
```

配置后 `GET /v1/models` 会自动返回 `DeepSeek 4.1 Flash`，并作为文本模型默认首选。`DEEPSEEK_MODEL` 必须与上游实际模型 ID 一致；如果网关使用别名，改这个值即可。

## 运行

```bash
# 在仓库根目录
docker-compose -f server/docker-compose.yml up -d postgres redis

cd server
cp .env.example .env
npm install
npm run prisma:migrate
npm run dev
```

生产拆分：

```bash
# API 只入队，不执行任务
WORKER_DISABLED=true npm run start

# 独立 Worker
npm run start:worker
```

默认地址：`http://localhost:8790`，接口前缀 `/v1`。

前端设置：

- API 地址：`http://localhost:8790/v1`
- 实时通道：`ws://localhost:8790`
- 本地开发可不填 token；配置 `API_TOKEN` 后必须填写。

## BYOK（用户自带 API Key）

供应商目录由平台维护，用户在「AI 设置 → 我的供应商」绑定自己的 Key。Key 使用
AES-256-GCM 信封加密存储，接口只返回掩码，任务表只保存 `credentialId`。

```bash
KEY_ENCRYPTION_SECRET=请替换为随机长字符串
```

```text
GET    /v1/providers
GET    /v1/providers/:providerId/credentials
POST   /v1/providers/:providerId/credentials
PATCH  /v1/providers/:providerId/credentials/:credentialId
DELETE /v1/providers/:providerId/credentials/:credentialId
POST   /v1/providers/:providerId/credentials/:credentialId/test
GET    /v1/providers/:providerId/models
POST   /v1/providers/:providerId/models/sync
GET    /v1/user/models
PUT    /v1/user/models
```

第一版已打通 OpenAI 兼容文本模型（DeepSeek / OpenAI / SiliconFlow 等）；图片、视频生成待接入真实供应商。

## 接口

```text
GET  /v1/health
GET  /v1/models
POST /v1/uploads
POST /v1/text/generations
POST /v1/image/generations
POST /v1/video/generations
GET  /v1/tasks/:taskId
POST /v1/tasks/:taskId/cancel
POST /v1/realtime/tickets
WS   /v1/realtime?ticket=...
```

完整契约见 `docs/backend-api-plan.md`。

## 测试

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## 管理端

`ash
npm run dev:admin   # http://localhost:8791/admin
`

- AdminJS：/admin，默认中文界面，管理 ModelConfig / ProviderConfig / ProviderModel / Task / 用户凭据（凭据只读且隐藏密文）。
- Bull Board：/admin/queues，Basic Auth 使用 ADMIN_EMAIL / ADMIN_PASSWORD。
- 模型目录已改为读取 ModelConfig 表；ProviderConfig 目前只做配置管理，DeepSeek 运行时仍读环境变量。
- 管理端依赖 .env 中的 ADMIN_EMAIL、ADMIN_PASSWORD、ADMIN_COOKIE_SECRET、ADMIN_PORT。
