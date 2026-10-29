# Infinite Canvas API

当前是可直接联调的后端骨架：

- NestJS + Fastify，统一 `{ code, message, data }` 响应。
- 模型目录、图片上传、文本/图片/视频异步任务、任务查询/取消、WebSocket 实时推送。
- 任务与幂等键持久化到 PostgreSQL（Prisma）；实时票据在内存，上传文件落本地磁盘，生成结果由 Mock Provider 产生。
- Redis + BullMQ 负责任务队列；`npm run dev` 默认在 API 进程内启动 Worker，生产可拆成独立 Worker 进程。

后续替换点：S3/OSS、真实模型 Provider、生产鉴权与限流。

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
