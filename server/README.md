# Infinite Canvas API

当前是可直接联调的后端骨架：

- NestJS + Fastify，统一 `{ code, message, data }` 响应。
- 模型目录、图片上传、文本/图片/视频异步任务、任务查询/取消、WebSocket 实时推送。
- 任务与票据暂存在内存，上传文件落在本地磁盘，生成结果由 Mock Provider 产生。

后续替换点：PostgreSQL/Prisma、Redis/BullMQ、S3/OSS、真实模型 Provider、鉴权与限流。

## 运行

```bash
cd server
cp .env.example .env
npm install
npm run dev
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
