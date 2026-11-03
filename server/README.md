# Infinite Canvas API

当前是可直接联调的后端骨架：

- NestJS + Fastify，统一 `{ code, message, data }` 响应。
- 模型目录、图片上传、文本/图片/视频异步任务、任务查询/取消、WebSocket 实时推送。
- 任务与幂等键持久化到 PostgreSQL（Prisma）；实时票据在内存，上传文件落本地磁盘。
- 所有生成模型统一走用户在前端绑定的供应商 Key（BYOK），服务端不保存平台级模型 Key。
- Redis + BullMQ 负责任务队列；`npm run dev` 默认在 API 进程内启动 Worker，生产可拆成独立 Worker 进程。
- 任务事件通过 Redis Pub/Sub 跨进程广播；拆分 API 和 Worker 后实时推送仍然可用。

后续替换点：S3/OSS、生产级限流。

## Docker Compose 运行（推荐）

```bash
cd server
cp .env.example .env

# 首次启动会构建镜像、执行 Prisma 迁移
docker compose up -d --build

# 首次需要初始化供应商目录和默认用户
docker compose run --rm seed
```

服务地址：

- API：`http://localhost:8790/v1`
- 管理端：`http://localhost:8791/admin`
- PostgreSQL：`localhost:5432`（canvas / canvas）
- Redis：`localhost:6379`

Compose 启动的是 API + 独立 Worker + Admin + PostgreSQL + Redis。前端仍在仓库根目录用 `npm run dev` 启动，Vite 会把 `/v1` 代理到 `http://localhost:8790`。

常用命令：

```bash
docker compose logs -f api worker
docker compose restart api worker
docker compose down          # 停止，保留数据
docker compose down -v       # 停止并清空数据库/上传卷
```

## 本机直接运行（不用 Docker）

```bash
cd server
cp .env.example .env
npm install
npm run prisma:migrate
npm run build
npm start
```

> `npm run dev` 使用 tsx，而 tsx/esbuild 不支持 NestJS 需要的 `emitDecoratorMetadata`，会报依赖注入错误；本地开发请使用 `npm run build && npm start`，或改用 `ts-node`。

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

## 多用户与 API Token

每个用户使用自己的 bearer token，服务端只保存 SHA-256 哈希。用 CLI 创建、撤销和查看：

```bash
cd server
npm run token:create -- --user alice --label laptop
npm run token:list
npm run token:revoke -- --id <tokenId>
```

`token:create` 会自动创建不存在的用户，并只显示一次明文 token。前端设置里的“访问令牌”填这个值即可。`API_TOKEN` 保留为单用户部署的引导令牌；多用户部署建议留空，并设置 `DEV_ALLOW_ANONYMOUS=false`。

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

文本、图片、视频生成都通过用户绑定的供应商 Key 执行（OpenAI 兼容 / 智谱适配器）。

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

```bash
npm run dev:admin   # http://localhost:8791/admin
`

- AdminJS：/admin，默认中文界面，管理 ProviderConfig / ProviderModel / Task / 用户凭据 / API Token（凭据和 Token 只读且隐藏密文）。
- Bull Board：/admin/queues，Basic Auth 使用 ADMIN_EMAIL / ADMIN_PASSWORD。
- 模型目录由 ProviderModel 决定，每个用户再通过偏好选择启用哪些模型；ProviderConfig 管理供应商接入信息。
- 管理端依赖 .env 中的 ADMIN_EMAIL、ADMIN_PASSWORD、ADMIN_COOKIE_SECRET、ADMIN_PORT。
