# Infinite Canvas 接入 AI 生成能力开发文档

> 范围：文本生成、图片生成、视频生成  
> 目标仓库：`D:\Desktop\code\infinite-canvas`（Vite + React 19 + React Flow + Zustand，local-first）  
> 接口策略：重新设计一套 camelCase API；HTTP 响应统一 `{ code, message, data }`；文本生成不流式，后端生成完成后一次性返回  
> 文档状态：已进入开发，核心链路已落地  
> 实现进度：Mock 默认开启；文本同步、图片/视频任务、任务恢复、AI 面板、Video 节点已实现；真实接口需按本文契约联调

---

## 1. 设计原则

### 1.1 产品目标

在现有无限画布中加入三类生成能力：

1. **文本生成**：节点内输入提示词，后端生成完成后一次性返回完整文本；可重试、保留历史结果。
2. **图片生成**：文生图、图生图，支持多图结果和上游图片/文本作为参考。
3. **视频生成**：文生视频、图生视频、首尾帧、参考视频，结果在视频节点内播放。

同时保持：

- 原有编辑、连线、分组、撤销、导入导出能力不退化。
- 生成结果、模型、参数、历史随画布快照持久化。
- 刷新后可恢复图片/视频任务；文本生成未完成时提示重新生成。
- 先做 Mock，再接真实接口，UI 与后端可并行开发。

### 1.2 接口设计原则

- **HTTP 响应统一**：成功与失败都返回 `{ code, message, data }`；`code === 0` 表示成功。
- **全 camelCase**：字段、枚举值、事件名统一小驼峰。
- **不复用旧接口的冗余字段**：去掉 `provider` / `provider_code` / `channel_strategy` / `taskStatus` / `imageUrls` 等历史包袱。
- **资源化**：文本、图片、视频都是“生成资源”；图片/视频异步任务统一为 `Task`。
- **结果统一**：图片/视频结果都落在 `result.items[]`，不再按 `imageUrl` / `videoUrl` / `audioUrl` 分叉。
- **显式模式**：请求带 `mode`，比从媒体列表反推 provider 更稳定，也便于后端校验和计费。
- **服务端权威校验**：前端只做必要预校验，比例、时长、分辨率、数量等最终由服务端按模型能力校验。
- **文本一次性返回**：文本节点不使用 SSE，也不做逐字渲染；请求在生成完成后返回完整文本。
- **幂等**：图片/视频生成请求带 `clientRequestId`，避免网络重试产生重复扣费。
- **无画布节点依赖**：生成接口不要求服务端存在画布或节点，当前 local-first 架构可直接接入。

### 1.3 本方案对 `app` 实现的优化

| `app` 旧实现 | 本方案 | 优化原因 |
| --- | --- | --- |
| 图片/视频请求使用 `provider: "text-to-image"` 等字符串 | 请求使用 `mode: "textToImage"` | `provider` 一词同时表示厂商、能力、渠道，含义混乱；`mode` 只表示生成模式 |
| `provider_code` / `channel_strategy` 混在生成参数里 | 本期不暴露；如需要，放 `routing` 对象 | 渠道调度是后端策略，不应污染业务参数 |
| 图片结果在 `imageUrl` / `imageUrls` / `videoUrl` / `thumbnailUrl` 多处 | 统一 `result.items[]` | 单一结果结构，前端渲染稳定 |
| 多图 URL 用逗号拼成一个字符串 | `items[]` 数组 | 避免拆分、转义和空值问题 |
| `taskStatus` 与 `status` 两种字段 | 统一 `status` | 减少映射 |
| `gen_status: "done"` / `"queuing"` | `status: "succeeded"` / `"queued"` | 枚举语义统一 |
| 文本生成依赖 Chat 会话或 SSE | 独立同步文本接口 | 画布节点不需要会话与逐字输出，结构更简单 |
| 图片生成使用 `input.messages[].content[{image},{text}]` | `prompt` + `references[]` | 画布场景没有多轮消息，结构更直接 |
| 图片参数 `ratio` / `aspect_ratio` / `size` / `quality` 重叠 | `aspectRatio` / `resolution` / `qualityTier` | 三个字段各司其职 |
| 任务只靠 WebSocket、HTTP 查询仅兜底 | WebSocket 与 HTTP 查询都是一等公民 | 静态部署、代理限制下 WebSocket 可能不可用 |
| WS 地址直接拼 JWT | 先换一次性 `ticket` | 避免 token 出现在 URL、日志和代理记录中 |
| 成功与失败响应结构不一致 | 统一 `{ code, message, data }` | 前端只写一套解包与错误处理 |
| snake_case 与 camelCase 混用 | 全 camelCase | 前端零映射 |

---

## 2. 总体架构

```text
节点 UI（Text / Image / Video）
  -> GenerationPanel
    -> GenerationController
      -> ReferenceResolver     上游文本/图片/视频
      -> MediaUploader         本地 idb:/data:/blob: -> https URL
      -> ModelRegistry         模型能力与参数约束
      -> AiProvider            可替换实现
        -> TextProvider        POST /v1/text/generations（同步一次性返回）
        -> ImageProvider       POST /v1/image/generations + Task
        -> VideoProvider       POST /v1/video/generations + Task
        -> MockProvider        无后端演示
      -> TaskManager           WS 订阅 + HTTP 轮询兜底 + 刷新恢复
    -> canvasStore.updateNodeData（写状态/结果）
```

关键点：

- 生成接口不依赖画布节点，本地节点 ID 只用于前端关联。
- `AiProvider` 隔离协议；后端接口调整只改 Provider。
- 节点数据是唯一展示来源；`TaskManager` 只负责把事件写回节点。
- 任务运行时句柄（AbortController、订阅）放模块级 Map，不进 Zustand、不进快照。
- 文本是“请求-等待-一次性返回”，没有 SSE、没有增量帧。

---

## 3. 新 API 契约

### 3.1 通用约定

| 项 | 约定 |
| --- | --- |
| Base URL | `https://{host}/v1`，由 `VITE_AI_API_BASE_URL` 配置 |
| 鉴权 | `Authorization: Bearer <token>` |
| 内容类型 | JSON 使用 `application/json`；上传使用 `multipart/form-data` |
| 字段命名 | 全部 camelCase |
| 枚举 | camelCase 或全小写，如 `textToImage`、`succeeded` |
| 时间 | ISO 8601 UTC，如 `2026-10-29T08:00:00Z` |
| ID | 不透明字符串，前端不解析 |
| HTTP 状态 | 保持语义：200/201/202、4xx、5xx |
| 响应格式 | 统一 `{ code, message, data }` |
| 成功 | `code === 0`；`data` 为资源或结果 |
| 失败 | `code !== 0`；`message` 可直接展示；`data` 为附加信息或 `null` |
| 请求追踪 | 响应头 `X-Request-Id` |
| 幂等 | 图片/视频生成请求带 `clientRequestId`，服务端 24h 内去重 |
| 限流 | `429` + `Retry-After` 秒数 |

成功：

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

失败：

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

建议业务码：

| code | 含义 |
| --- | --- |
| `0` | 成功 |
| `10001` | 未登录 / token 过期 |
| `10003` | 无权限 / 模型未开通 |
| `10004` | 模型、任务或记录不存在 |
| `10005` | 频率限制 |
| `20001` | 参数校验失败 |
| `20002` | 积分不足 |
| `20003` | 内容审核不通过 |
| `20004` | 模型暂不可用 |
| `20005` | 任务已终态，不能重复操作 |
| `20006` | 相同请求正在进行 |
| `30001` | 上游模型失败 |
| `50000` | 服务端内部错误 |

前端只判断 `code === 0`；错误码用于提示文案与埋点，不直接展示数字。

> WebSocket 属于事件流，不套 HTTP 响应壳，使用 `{ type, data }` 结构，见 §3.8。

### 3.2 模型列表

```http
GET /v1/models?kind=image
GET /v1/models?kind=video
GET /v1/models?kind=text
GET /v1/models                 # 不传 kind 返回全部
```

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "models": [
      {
        "id": "seedance-1-0-pro",
        "name": "Seedance 1.0 Pro",
        "kind": "video",
        "modes": ["textToVideo", "imageToVideo", "firstLastFrame"],
        "description": "支持文生视频、图生视频与首尾帧",
        "logoUrl": "https://cdn.example.com/models/seedance.png",
        "limits": {
          "maxPromptLength": 2000,
          "maxImages": 2,
          "maxVideos": 1
        },
        "output": {
          "image": null,
          "video": {
            "aspectRatios": ["16:9", "9:16", "1:1"],
            "resolutions": ["480p", "720p", "1080p"],
            "minDuration": 4,
            "maxDuration": 12,
            "supportsAudio": true
          }
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
        "pricing": {
          "baseCredits": 10,
          "perSecondCredits": 2
        }
      }
    ]
  }
}
```

字段规则：

- `id` 是请求中使用的唯一标识，请求字段统一叫 `modelId`。
- `kind`：`text` / `image` / `video`。
- `modes`：
  - 图片：`textToImage` / `imageToImage`
  - 视频：`textToVideo` / `imageToVideo` / `firstLastFrame` / `referenceVideo`
  - 文本：空数组或省略
- `output.image` 结构：

```json
{
  "aspectRatios": ["1:1", "4:3", "16:9"],
  "resolutions": ["1k", "2k", "4k"],
  "maxCount": 4
}
```

- `output.video` 结构：

```json
{
  "aspectRatios": ["16:9", "9:16", "1:1"],
  "resolutions": ["480p", "720p", "1080p"],
  "minDuration": 4,
  "maxDuration": 12,
  "supportsAudio": true
}
```

- `params.qualityTiers` / `params.backgrounds` / `params.extra` 可为空或省略。
- `pricing` 可选；前端只用于展示预估，不参与提交。
- 模型列表缓存 60s；支持 `ETag` / `If-None-Match` 更佳。

### 3.3 文件上传

```http
POST /v1/uploads
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `file` | 是 | 图片或视频文件 |

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

- 图片最大 20MB，视频最大 200MB（可按业务调整）。
- `url` 必须可被生成服务访问。
- `assetId` 可选，用于内容身份；没有就省略。
- 返回的 URL 若带过期时间，需同时返回 `expiresAt`。

### 3.4 文本生成（同步一次性返回）

```http
POST /v1/text/generations
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
| `modelId` | 是 | 文本模型 ID |
| `prompt` | 是 | 用户提示词 |
| `systemPrompt` | 否 | 系统提示词 |
| `params` | 否 | 温度、最大输出 token 等 |
| `clientRequestId` | 是 | 幂等键；同一节点重试时建议复用，避免重复生成 |

响应（生成完成后返回）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "generationId": "gen_123",
    "status": "succeeded",
    "modelId": "gpt-4-1-mini",
    "text": "第一点，明确目标。\n第二点，拆解路径。\n第三点，定义验收标准。",
    "usage": {
      "inputTokens": 120,
      "outputTokens": 80
    },
    "finishReason": "stop",
    "createdAt": "2026-10-29T08:00:00Z",
    "completedAt": "2026-10-29T08:00:12Z"
  }
}
```

失败：

```json
{
  "code": 20003,
  "message": "内容不符合规范",
  "data": null
}
```

规则：

- 不返回 SSE；没有 `delta`、没有逐字渲染。
- 请求在生成完成后返回；客户端需把超时放宽到 300s，并在 UI 显示“生成中”不确定进度。
- 文本生成不做服务端任务恢复；请求中断或刷新后，节点保留上一次成功文本，状态标记为失败，提示重新生成。
- 若首次请求超时，重试时复用同一个 `clientRequestId`：服务端若已完成则直接返回已有结果；若仍在进行则返回 `20006`。
- 节点在生成期间**不清空旧文本**，成功后再整体替换，避免等待期间内容消失。
- 若后端生成耗时可能超过网关超时（建议控制在 120s 内），需要改为异步 Task 模式；`TextProvider` 接口已隔离，替换实现不影响 UI。

### 3.5 图片生成

```http
POST /v1/image/generations
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
    {
      "type": "reference",
      "url": "https://cdn.example.com/upl/123.png",
      "assetId": "asset_123"
    }
  ],
  "params": {
    "aspectRatio": "1:1",
    "resolution": "1k",
    "count": 1,
    "qualityTier": "high",
    "background": "opaque",
    "watermark": true,
    "seed": 0,
    "extra": {
      "style": "realistic"
    }
  },
  "clientRequestId": "node-abc:req-01J..."
}
```

字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `modelId` | 是 | 图片模型 ID |
| `mode` | 是 | `textToImage` 或 `imageToImage` |
| `prompt` | 是 | 提示词 |
| `negativePrompt` | 否 | 负向提示词 |
| `references` | 否 | 参考图数组；`mode=imageToImage` 时至少 1 张 |
| `params.aspectRatio` | 否 | 默认取模型第一项 |
| `params.resolution` | 否 | 1k/2k/4k，必须在模型 `resolutions` 中 |
| `params.count` | 否 | 生成数量，默认 1，服务端按模型 `maxCount` 收敛 |
| `params.qualityTier` | 否 | 仅模型有 `qualityTiers` 时传 |
| `params.background` | 否 | 仅模型有 `backgrounds` 时传 |
| `params.watermark` | 否 | 默认 true |
| `params.seed` | 否 | 随机种子 |
| `params.extra` | 否 | 模型自定义参数，键来自 `params.extra[].key` |
| `clientRequestId` | 是 | 幂等键 |

`references[].type` 图片只允许 `reference`。

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

### 3.6 视频生成

```http
POST /v1/video/generations
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
    {
      "type": "firstFrame",
      "url": "https://cdn.example.com/upl/start.png"
    },
    {
      "type": "lastFrame",
      "url": "https://cdn.example.com/upl/end.png"
    }
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

字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `modelId` | 是 | 视频模型 ID |
| `mode` | 是 | `textToVideo` / `imageToVideo` / `firstLastFrame` / `referenceVideo` |
| `prompt` | 是 | 提示词 |
| `negativePrompt` | 否 | 负向提示词 |
| `references` | 否 | 媒体引用，见下表 |
| `params.aspectRatio` | 否 | 比例，默认模型第一项 |
| `params.resolution` | 否 | 480p/720p/1080p，必须在模型 `resolutions` 中 |
| `params.duration` | 否 | 秒，整数，服务端按 `minDuration`/`maxDuration` 校验 |
| `params.generateAudio` | 否 | 仅 `output.video.supportsAudio=true` 时允许 |
| `params.watermark` | 否 | 默认 true |
| `params.seed` | 否 | 随机种子 |
| `params.extra` | 否 | 模型自定义参数 |
| `clientRequestId` | 是 | 幂等键 |

`references[].type`：

| type | 用于 mode | 说明 |
| --- | --- | --- |
| `firstFrame` | `firstLastFrame` | 首帧 |
| `lastFrame` | `firstLastFrame` | 尾帧 |
| `referenceImage` | `imageToVideo` / `referenceVideo` | 参考图 |
| `referenceVideo` | `referenceVideo` | 参考视频 |

模式校验：

- `textToVideo`：不允许图片/视频引用。
- `imageToVideo`：至少 1 张 `referenceImage`，不允许首尾帧。
- `firstLastFrame`：必须恰好 1 张 `firstFrame` + 1 张 `lastFrame`。
- `referenceVideo`：至少 1 个 `referenceVideo`，可带 `referenceImage`。

响应 `202`：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "taskId": "task_456",
    "status": "queued",
    "createdAt": "2026-10-29T08:00:00Z"
  }
}
```

### 3.7 任务查询与取消

#### 查询

```http
GET /v1/tasks/{taskId}
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
          "url": "https://cdn.example.com/out/video.mp4",
          "thumbnailUrl": "https://cdn.example.com/out/poster.jpg",
          "duration": 5,
          "width": 1280,
          "height": 720,
          "assetId": "asset_456"
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

图片结果：

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
          "url": "https://cdn.example.com/out/a.png",
          "thumbnailUrl": "https://cdn.example.com/out/a_thumb.png",
          "width": 1024,
          "height": 1024,
          "assetId": "asset_789"
        }
      ]
    },
    "error": null,
    "createdAt": "2026-10-29T08:00:00Z",
    "updatedAt": "2026-10-29T08:00:20Z"
  }
}
```

规则：

- `status`：`queued` / `running` / `succeeded` / `failed` / `canceled`。
- `progress`：0–100；未知时可省略。
- 终态只有 `succeeded` / `failed` / `canceled`。
- `succeeded` 时 `result.items` 至少 1 项；`failed` 时 `result=null` 且 `error` 非空。
- `result.kind` 与 `task.kind` 一致。
- `expiresAt` 可选；过期后结果 URL 可能失效。

#### 取消

```http
POST /v1/tasks/{taskId}/cancel
```

响应：返回最新任务对象，外层仍是 `{ code, message, data }`。已终态返回 `20005`。

### 3.8 实时推送

> HTTP 响应统一 `{ code, message, data }`；WebSocket 属于事件流，使用 `{ type, data }`，不套 HTTP 壳。

#### 获取票据

```http
POST /v1/realtime/tickets
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

- `ticket` 一次性、短有效期（建议 60s）。
- 避免把 JWT 放到 WebSocket URL。

#### 连接

```text
wss://{host}/v1/realtime?ticket=rt_01J...
```

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
{
  "type": "error",
  "data": {
    "code": 10007,
    "message": "票据已过期"
  }
}
```

规则：

- `task.updated` 在状态/进度/终态变化时推送，`data.task` 结构与 `GET /v1/tasks/{taskId}` 的 `data` 完全一致。
- 终态推送必须带完整 `result` 或 `error`，客户端无需再查。
- 心跳：客户端每 20s 发 `ping`；超过 50s 未收到 `pong` 视为断线，重连并重新订阅。
- 连接断开后的补偿：重连成功后对未终态任务逐个 `GET`，避免漏事件。

### 3.9 幂等与重试

- 文本/图片/视频生成都带 `clientRequestId`。
- 图片/视频：服务端 24h 内对相同 `clientRequestId` 返回已有任务，HTTP 返回 `200` 而不是 `202`，`data` 仍是 `{taskId,status,createdAt}`。
- 文本：相同 `clientRequestId` 已完成则直接返回已有文本；仍在生成则返回 `20006`，客户端稍后重试。
- 客户端超时重试时复用同一个 `clientRequestId`。

---

## 4. 前端数据模型

### 4.1 类型扩展

```ts
// src/types.ts
export type NodeKind = "text" | "image" | "video" | "group";

export type GenerationKind = "text" | "image" | "video";
export type GenerationStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type GenerationError = {
  code: number;
  message: string;
};

export type GenerationUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type GenerationResultItem =
  | {
      id: string;
      kind: "text";
      text: string;
      modelId: string;
      createdAt: string;
      usage?: GenerationUsage;
    }
  | {
      id: string;
      kind: "image";
      url: string;
      thumbnailUrl?: string;
      width?: number;
      height?: number;
      assetId?: string;
      modelId: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "video";
      url: string;
      thumbnailUrl?: string;
      duration?: number;
      width?: number;
      height?: number;
      assetId?: string;
      modelId: string;
      createdAt: string;
    };

export type GenerationParams = {
  aspectRatio?: string;
  resolution?: string;
  count?: number;
  duration?: number;
  qualityTier?: string;
  background?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  seed?: number;
  extra?: Record<string, string | number | boolean>;
};

export type GenerationMeta = {
  kind: GenerationKind;
  prompt: string;
  modelId: string;
  mode?: string;
  status: GenerationStatus;
  progress?: number;
  taskId?: string;
  error?: GenerationError;
  results: GenerationResultItem[];
  activeResultId?: string;
  params?: GenerationParams;
  createdAt?: string;
  updatedAt?: string;
  /** 上游结果已更新，建议重新生成 */
  stale?: boolean;
};
```

节点数据：

```ts
export type TextData = {
  text: string;
  color: NoteColor;
  fontSize: number;
  generation?: GenerationMeta;
  [key: string]: unknown;
};

export type ImageData = {
  src: string;
  alt: string;
  generation?: GenerationMeta;
  [key: string]: unknown;
};

export type VideoData = {
  src: string;
  thumbnailUrl: string;
  alt: string;
  generation?: GenerationMeta;
  [key: string]: unknown;
};

export type VideoNodeModel = Node<VideoData, "video">;
```

### 4.2 展示字段同步

- 文本：`data.text` 始终等于 `generation.results[activeResultId].text`。生成中保留旧文本，成功后再整体替换；失败/取消也保留旧文本。
- 图片：`data.src` 始终等于当前 active image 的 `url`。
- 视频：`data.src` / `data.thumbnailUrl` 始终等于当前 active video 的 `url` / `thumbnailUrl`。
- 切换 active 结果时同时更新展示字段。

### 4.3 Schema v4

`src/lib/storage.ts`：

- `SCHEMA_VERSION = 4`
- `STORAGE_KEY = "infinite-canvas:v4"`
- `LEGACY_KEYS` 增加 `"infinite-canvas:v3"`
- `NODE_KINDS` 增加 `"video"`
- 新增 `sanitizeGeneration(value)`：
  - `kind` / `status` 白名单。
  - `prompt` 最大 20,000 字符。
  - `results` 最多 20 条。
  - `id` / `taskId` 只允许安全字符 `[A-Za-z0-9_-]`。
  - `url` / `thumbnailUrl` 只允许 `https:`、`idb:`；图片 `src` 仍允许 `data:image/`。
  - `progress` 限制 0–100。
  - `error` 只保留 `code` / `message`，`message` 截断 500 字符。
  - `params` 只保留已知键，`extra` 的值只允许 string/number/boolean。
  - 未知字段全部丢弃。
- `nodeData()` 增加 `video` 分支。
- 迁移 v3 → v4：
  - 旧节点原样保留。
  - 没有 `generation` 不补空对象。
  - 旧图片 `idb:` / `data:image/` 继续可用。
- 导出时版本写 4；图片 Blob 仍转 data URL；视频不内嵌。

### 4.4 任务缓存

```ts
// src/lib/ai/taskCache.ts
const KEY = "infinite-canvas:ai-tasks";

type PendingTask = {
  taskId: string;
  nodeId: string;
  kind: "image" | "video";
  modelId: string;
  prompt: string;
  startedAt: number;
  progress?: number;
};
```

- 只存图片/视频的未终态任务；文本是同步请求，不进任务缓存。
- 终态、节点删除、画布清空时移除。
- 启动时与节点 `generation.taskId` 对齐。
- 超过 30 分钟未终态：清理并标记失败。

---

## 5. 前端模块设计

### 5.1 目录

```text
src/lib/ai/
  config.ts          # base URL、超时、mock 开关
  auth.ts            # token provider
  http.ts            # 请求、响应解包 { code, message, data }、错误
  realtime.ts        # ticket + WebSocket 客户端
  types.ts           # API 类型（Task / Model）
  models.ts          # 模型列表、缓存、能力查询
  payload.ts         # 图片/视频/文本请求构建
  provider.ts        # AiProvider 接口
  providers/
    mock.ts
    text.ts
    image.ts
    video.ts
  controller.ts      # 生成编排与状态机
  taskManager.ts     # 任务订阅、轮询、恢复
  taskCache.ts       # 未完成任务缓存
  media.ts           # 本地引用上传
  refs.ts            # 上游引用收集
src/components/ai/
  GenerationPanel.tsx
  ModelSelect.tsx
  GenerationStatus.tsx
  AiSettingsDialog.tsx
src/components/nodes/VideoNode.tsx
```

### 5.2 配置

```ts
// src/lib/ai/config.ts
export const AI_CONFIG = {
  apiBase: import.meta.env.VITE_AI_API_BASE_URL ?? "",
  realtimeBase: import.meta.env.VITE_AI_REALTIME_BASE_URL ?? "",
  mock: import.meta.env.VITE_AI_MOCK === "1",
  requestTimeoutMs: 30_000,
  textTimeoutMs: 300_000,
  uploadTimeoutMs: 300_000,
  taskTimeoutMs: 30 * 60 * 1000,
  pollIntervalMs: 5_000,
};
```

`.env.example`：

```bash
VITE_AI_API_BASE_URL=
VITE_AI_REALTIME_BASE_URL=
VITE_AI_MOCK=0
```

- 前端只放公开配置，不放密钥。
- token 由宿主注入；独立运行时用设置弹窗写 `sessionStorage`。

```ts
// src/lib/ai/auth.ts
type TokenGetter = () => string | null;

let getter: TokenGetter = () => sessionStorage.getItem("ic:ai-token");

export function setAiTokenProvider(fn: TokenGetter) {
  getter = fn;
}

export function getAiToken(): string | null {
  return getter();
}
```

### 5.3 HTTP

```ts
export class AiRequestError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
    public status?: number,
  ) {
    super(message);
  }
}

export async function aiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    timeout?: number;
  } = {},
): Promise<T>;
```

行为：

- 拼接 `apiBase + path`。
- 自动加 `Authorization`。
- JSON 序列化，`FormData` 不设置 `Content-Type`。
- 默认 30s 超时；文本 300s；上传 5 分钟。
- 解析 `{ code, message, data }`：
  - `code === 0` → 返回 `data`。
  - `code !== 0` → 抛 `AiRequestError(code, message, data, httpStatus)`。
  - 响应不是合法 envelope → 抛“服务响应格式异常”。
- `401` / `code=10001` 回调宿主 `onUnauthorized`，不做路由跳转。
- 网络错误转中文提示，不暴露浏览器英文原文。
- 不自动重试；由上层用同一 `clientRequestId` 重试。

### 5.4 文本请求

`providers/text.ts`：

- 调用 `POST /v1/text/generations`，超时 300s。
- 请求期间节点状态 `running`，UI 显示不确定进度/“生成中”。
- 成功：用 `data.text` 整体替换节点文本，写入结果。
- 失败：保留旧文本，写入错误，状态 `failed`。
- 取消：abort HTTP 请求；UI 标记 `canceled`，提示“已取消等待，服务端可能仍在生成”。
- 不做流式渲染，不处理增量帧。

### 5.5 实时通道

`realtime.ts`：

- `getTicket()` → `POST /v1/realtime/tickets`，取 `data.ticket`。
- 连接 `{realtimeBase}/v1/realtime?ticket=...`。
- 单例；多个任务共享。
- 心跳 20s；50s 无 `pong` 重连。
- 重连后重新订阅所有未终态 taskId。
- 事件只做转发，不直接写节点；由 `taskManager` 处理。
- 没有 `realtimeBase` 或连接失败 → 纯轮询模式。

### 5.6 模型

`models.ts`：

- `listModels(kind?)`：拉取 `data.models`、缓存 60s、并发去重。
- `getModel(modelId)`：从缓存查找。
- 失败时保留上次缓存；首次失败抛出可读错误。
- UI 只依赖 `AiModel`，不直接处理 API 原始结构。

### 5.7 Provider

```ts
// src/lib/ai/provider.ts
export type GenerationEvent =
  | { type: "accepted"; taskId?: string }
  | { type: "progress"; progress: number }
  | { type: "completed"; results: GenerationResultItem[]; usage?: GenerationUsage }
  | { type: "failed"; error: GenerationError };

export type GenerateInput = {
  nodeId: string;
  kind: GenerationKind;
  prompt: string;
  modelId: string;
  mode?: string;
  params: GenerationParams;
  references: ReferenceInput[];
  signal?: AbortSignal;
  clientRequestId: string;
};

export interface AiProvider {
  generate(
    input: GenerateInput,
    emit: (event: GenerationEvent) => void,
  ): Promise<{ cancel: () => Promise<void> | void }>;
}
```

- `TextProvider`：同步请求；无 `accepted`，直接 `completed` / `failed`。
- `ImageProvider` / `VideoProvider`：提交任务后 emit `accepted`，由 `taskManager` 推送进度与终态。
- `MockProvider`：按延时输出；用于无后端演示。
- 未来更换后端只需新增/替换 Provider。

---

## 6. 生成编排

### 6.1 上游引用

```ts
// src/lib/ai/refs.ts
export type ReferenceInput = {
  type: "reference" | "referenceImage" | "firstFrame" | "lastFrame" | "referenceVideo";
  url: string;
  assetId?: string;
};

export function collectUpstream(nodeId: string, nodes: CanvasNode[], edges: CanvasEdge[]): {
  texts: string[];
  references: ReferenceInput[];
};
```

规则：

- 沿 `target === nodeId` 的边向上游。
- 上游 Text：取 `text`，空则取当前 active 文本结果。
- 上游 Image：取 `src`，本地引用交给 `media.ts` 上传。
- 上游 Video：取 `src`。
- 提示词拼接：

```text
<节点自己的 prompt>

--- 上游文本 ---
<文本 1>
<文本 2>
```

- 图片/视频不拼进文本，通过 `references` 传。
- 上限：图片 8 张、视频 3 个；最终以模型 `limits` 再校验。
- 去重：URL 去重，文本按内容去重。

### 6.2 本地上传

```text
idb:<id>  -> getImageBlob -> File -> POST /v1/uploads -> url
data:     -> fetch -> Blob -> File -> POST /v1/uploads -> url
blob:     -> fetch -> Blob -> File -> POST /v1/uploads -> url
https:    -> 直接使用
```

- 内存缓存 `Map<ref, UploadResult>`，同一图片只上传一次。
- 上传失败：把错误抛给编排层；纯文本生成可忽略图片上传失败并提示。
- 视频本地文件第一版不做上传入口；只支持远程 URL / 上游视频。

### 6.3 提交流程

```ts
async function generate(nodeId: string, kind: GenerationKind) {
  const node = getNode(nodeId);
  if (!node || isRunning(nodeId)) return;

  commit(); // 生成前只记一次历史

  updateGeneration(nodeId, {
    status: kind === "text" ? "running" : "queued",
    progress: 0,
    error: undefined,
    stale: false,
  });

  const { texts, references } = collectUpstream(nodeId, nodes, edges);
  const prompt = buildPrompt(node, texts);
  const model = getModel(generation.modelId);
  validateLocal(model, prompt, references);

  const uploaded = await uploadReferences(references);
  const provider = pickProvider(kind);

  const job = await provider.generate(
    {
      nodeId,
      kind,
      prompt,
      modelId: model.id,
      mode: generation.mode,
      params: generation.params ?? {},
      references: uploaded,
      clientRequestId: `${nodeId}:${crypto.randomUUID()}`,
    },
    (event) => applyEvent(nodeId, event),
  );

  activeJobs.set(nodeId, job);
}
```

### 6.4 事件处理

```ts
function applyEvent(nodeId: string, event: GenerationEvent) {
  switch (event.type) {
    case "accepted":
      updateGeneration(nodeId, { status: "running", taskId: event.taskId });
      if (event.taskId) taskManager.watch(event.taskId, nodeId);
      break;

    case "progress":
      updateGeneration(nodeId, { progress: event.progress });
      break;

    case "completed":
      finishGeneration(nodeId, event.results);
      break;

    case "failed":
      failGeneration(nodeId, event.error);
      break;
  }
}
```

### 6.5 状态机

```text
idle
  -> queued            # 图片/视频提交
  -> running           # 任务运行 / 文本请求等待
  -> succeeded
  -> failed
  -> canceled
  -> queued（重试）
```

约束：

- 同一节点只允许一个进行中任务。
- `queued` / `running` 时 UI 禁用参数修改，按钮变“取消等待”。
- 图片/视频取消：调 `POST /v1/tasks/{id}/cancel`；接口失败则仍停止本地等待并提示“已停止等待，服务端任务可能仍在运行”。
- 文本取消：abort HTTP 请求；服务端可能继续生成，不承诺取消。
- 失败必须保留 `error.code` / `error.message`，支持重试。
- 成功写入结果后，把下游节点 `generation.stale = true`（第一版只标直接下游）。

### 6.6 任务管理

`taskManager.ts`：

```ts
type WatchedTask = {
  taskId: string;
  nodeId: string;
  startedAt: number;
};

const watched = new Map<string, WatchedTask>();

export const taskManager = {
  watch(taskId: string, nodeId: string): void;
  unwatch(taskId: string): void;
  /** 启动时恢复 */
  resumeAll(): Promise<void>;
  /** 节点删除/清空画布 */
  disposeNode(nodeId: string): void;
};
```

行为：

- `watch`：加入映射、订阅实时通道、写入任务缓存。
- 实时事件到达：按 taskId 找 nodeId，写节点；终态时 `unwatch`。
- 无实时通道或 10s 未收到任何事件：启动轮询，每 5s 查一次 `GET /v1/tasks/{taskId}`。
- 轮询和实时同时可用时，以先到终态为准；用 `settledTaskIds` 去重。
- 任务超 30 分钟：标记失败并清理。
- 节点删除：`disposeNode` 取消订阅、清理缓存；不调用取消接口（避免误伤用户可能仍想要的结果），可在后续版本提供“删除时取消任务”开关。

### 6.7 刷新恢复

启动时：

1. 读取任务缓存。
2. 找到对应节点。
3. 节点不存在 → 清理。
4. `kind=image|video` 且有 `taskId`：
   - `GET /v1/tasks/{taskId}` 拿当前状态。
   - 终态 → 写结果并清理。
   - 非终态 → `watch`。
5. `kind=text` 且状态为 `running`：
   - 文本是同步请求，刷新后请求已中断。
   - 保留旧文本，状态改 `failed`，错误提示“生成已中断，请重新生成”。
6. 超过 30 分钟未终态：标记失败并清理。

### 6.8 文本一次性写入

- 请求期间不修改 `data.text`，只把 `generation.status` 设为 `running`，UI 显示“生成中”。
- 成功后：
  - 用返回的 `data.text` 整体替换 `data.text`。
  - `results` 插入一条文本结果，`id = data.generationId`。
  - `activeResultId` 指向新结果。
  - `status = "succeeded"`。
- 失败 / 取消：保留旧文本与上一次 active 结果，只写错误/状态。
- 不 `commit()` 生成过程中的状态；开始前 `commit()` 一次即可，避免撤销历史被中间状态污染。

---

## 7. 节点与交互

### 7.1 VideoNode

`src/components/nodes/VideoNode.tsx`：

- `<video controls preload="metadata" src={src} poster={thumbnailUrl} />`。
- 空态：上传/生成提示。
- 选中时可缩放；`MIN_SIZE.video` = 220×160，默认 360×240。
- 左右 Handle 与 Text/Image 一致。
- 生成中遮罩 + 进度。
- 失败显示错误摘要 + 重试。
- 底部显示模型名、时长、分辨率。

注册：

```ts
const nodeTypes = { text, image, video, group };
```

### 7.2 GenerationPanel

文本/图片/视频节点共用：

```text
┌──────────────────────────────────────┐
│ 模型 [ Seedance 1.0 Pro           ▾ ]│
│ 模式 [ 首尾帧                     ▾ ]│
│ 提示词 [                           ] │
│ 比例 [16:9 ▾] 分辨率 [720p ▾] 时长 5s│
│ [生成]  [取消等待]   生成中…          │
│ 结果： [1] [2] [3] [4]                │
│ 错误：xxx（点击重试）                  │
└──────────────────────────────────────┘
```

规则：

- 模型下拉按 `kind` 分组，只显示可用模型。
- 切换模型时按新模型能力重置参数，非法值不保留。
- 模式下拉只显示 `model.modes`。
- 比例、分辨率、时长、数量、画质档、背景、自定义参数全部由 `model.output` / `model.params` 生成。
- 自定义参数只支持 `select` / `slider`；值放 `params.extra`。
- 生成中禁用参数编辑。
- 文本生成没有百分比进度，显示“生成中…”；图片/视频显示进度或“排队中”。
- 结果条点击切换 `activeResultId`，同步节点展示字段。
- 图片结果提供“设为参考图”快捷操作（可选）。
- 文本结果提供复制按钮。
- 错误展示 `error.message`；`error.code` 用于埋点/提示文案。

### 7.3 节点入口

- `Toolbar` 新增 `AI Text`、`AI Image`、`AI Video`，或保留现有 Text/Image 并新增 Video。
- `ContextMenu` 的 `ADD_ITEMS` 增加 `video`。
- 连线拖到空白创建节点时允许 `video`。
- `CommandPalette` 增加“Add video node”。

### 7.4 连线与引用

- Text → 任意生成节点：作为文本上下文。
- Image → Image/Video：作为参考图。
- Video → Video：作为参考视频。
- 生成节点 → 下游：输出当前 active 结果。
- 第一版保持宽松连接；生成前按模型 `modes` / `limits` 校验并给出可读提示。
- 后续可加端口类型与连接校验，不阻塞当前自由连线体验。

### 7.5 状态样式

- `queued`：边框脉冲，文案“排队中”。
- `running`：进度条 + 百分比（图片/视频）；文本显示“生成中…”。
- `succeeded`：无额外高亮。
- `failed`：红色边框 + 错误条。
- `stale`：黄色提示“上游已更新，建议重新生成”。
- 状态变化用 `aria-live="polite"` 播报，不仅靠颜色。

---

## 8. 持久化与导出

### 8.1 快照

- `generation` 随节点写入快照。
- 图片/视频 `queued` / `running` 也写入，启动时配合任务缓存恢复。
- 文本 `running` 也写入，但启动时直接改 `failed`，不做恢复。
- 不存 AbortController、上传缓存、WebSocket 订阅、临时 Blob URL。

### 8.2 生成资源

默认保留远程 URL：

- 图片：`https` URL 直接写 `src`。
- 视频：`https` URL 直接写 `src`，`thumbnailUrl` 写封面。
- 风险：CDN 签名 URL 过期；节点提供“重新生成”兜底。

可选镜像（后续）：

- `VITE_AI_MIRROR_IMAGES=1` 时图片生成后 `fetch -> storeImage(blob) -> src=idb:...`。
- 需要 CORS 允许。
- 视频不镜像，避免 IndexedDB 配额问题。
- `generation.results[].url` 始终保留原始远程 URL。

### 8.3 导出

- 沿用现有导出逻辑。
- 图片 `idb:` 内嵌为 data URL。
- 视频只写远程 URL。
- `version: 5`。
- 导入旧 v3 快照自动迁移。

### 8.4 清理

- 删除节点：
  - 取消本地等待。
  - 清理任务缓存。
  - 镜像图片由现有 `pruneOrphanImages` 清理。
- 清空画布 / 导入新快照：
  - 清理所有任务缓存与订阅。
- 任务终态：
  - 从缓存移除，保留节点结果。

---

## 9. 配置、鉴权、部署与安全

### 9.1 鉴权

- 画布不实现登录。
- 宿主通过 `setAiTokenProvider(fn)` 注入 token。
- 独立运行提供 AI 设置弹窗：
  - API Base、Realtime Base、Token。
  - Token 存 `sessionStorage`。
  - 不写仓库、不打印控制台、不回显完整 token。

### 9.2 CORS / 代理

- 浏览器直连需要后端允许画布域名、`Authorization` header、WebSocket Origin。
- Vite 开发代理：

```ts
server: {
  proxy: {
    "/v1": { target: process.env.VITE_AI_PROXY_TARGET, changeOrigin: true },
    "/v1/realtime": { target: process.env.VITE_AI_PROXY_TARGET, ws: true },
  },
}
```

- 静态托管（如 GitHub Pages）无法反代时，使用 Cloudflare Worker / Netlify Function 做同源 BFF，或把画布部署到 API 同域。
- WebSocket 失败必须自动降级轮询，不能阻塞生成。

### 9.3 安全

- 前端 bundle 不放长期密钥。
- URL 白名单：`https:`、`idb:`、`data:image/`；拒绝 `javascript:`、`file:`。
- 文本按纯文本渲染，不用 `dangerouslySetInnerHTML`。
- 视频 `src` / `poster` 同样校验。
- 错误信息截断，不展示后端堆栈、token、完整 prompt。
- 日志只记录节点 ID、任务 ID、模型 ID、错误码；prompt 只记录长度（开发模式可开关）。
- 上传文件校验 MIME 与大小；服务端仍需二次校验。

---

## 10. 实施计划

### 阶段 0：契约与 Mock（0.5 天）

- [ ] 固化本文 API 契约，后端确认字段与枚举。
- [ ] 新增 `src/lib/ai/` 类型、Provider 接口、MockProvider。
- [ ] `VITE_AI_MOCK=1` 时文本一次性返回、图片占位、视频占位。
- 验收：无后端也能完整走通三个节点。

### 阶段 1：请求层与模型（1 天）

- [ ] `config` / `auth` / `http` / `realtime`。
- [ ] `http.ts` 统一解包 `{ code, message, data }`。
- [ ] `models.ts` 拉取、缓存、错误处理。
- [ ] AI 设置弹窗。
- [ ] 单测：响应解包、业务错误码、401、超时、模型解析。

### 阶段 2：文本生成（0.5 天）

- [ ] `providers/text.ts` 同步请求。
- [ ] TextNode 面板、生成中状态、取消等待、失败重试。
- [ ] schema v5 与 `sanitizeGeneration`。
- 验收：点击生成后等待并整体替换文本；失败保留旧文本；刷新后未完成状态变为失败。

### 阶段 3：图片生成（1.5 天）

- [ ] `media.ts` 上传。
- [ ] `providers/image.ts`。
- [ ] `taskManager` 实时 + 轮询。
- [ ] ImageNode 多图、active 切换、错误重试。
- 验收：文生图/图生图、多图切换、上游参考图可用。

### 阶段 4：视频生成（1.5 天）

- [ ] `VideoNode` 与注册/菜单/命令面板。
- [ ] `providers/video.ts`，模式与引用校验。
- [ ] 播放、封面、下载、错误重试。
- 验收：文生视频/图生视频/首尾帧可用。

### 阶段 5：编排与恢复（1.5 天）

- [ ] `controller.ts` 状态机、单节点并发锁。
- [ ] 任务缓存与启动恢复。
- [ ] 上游引用收集、提示词拼接。
- [ ] 删除节点/清空画布清理。
- [ ] 下游 stale。
- 验收：刷新恢复、删除无残留、任务不重复提交。

### 阶段 6：体验与收尾（1 天）

- [ ] 进度/排队/失败/空态/aria。
- [ ] 模型切换参数重置。
- [ ] README / ROADMAP 更新。
- [ ] 全量回归。
- 验收：`npm run typecheck`、`npm run lint`、`npm test`、`npm run build` 全绿；1000 节点基准不退化。

总工期约 6.5 人日（不含后端实现、联调与部署代理）。

---

## 11. 测试计划

### 11.1 单元测试

| 模块 | 用例 |
| --- | --- |
| `http.ts` | `{code:0}` 解包；非 0 抛错；非法 envelope；401；超时 |
| `payload.ts` | 图片模式与引用；视频四种模式；参数越界；extra 合并 |
| `providers/text.ts` | 成功整体替换；失败保留旧文本；取消 |
| `controller.ts` | idle→queued/running→succeeded/failed/canceled；重复提交拦截；节点删除 |
| `taskManager.ts` | WS 事件、轮询兜底、终态去重、超时、恢复 |
| `taskCache.ts` | 写入/读取/过期/节点不存在清理 |
| `refs.ts` | 上游文本/图片/视频收集、去重、空值忽略 |
| `media.ts` | `idb:`/`data:`/`blob:`/`https:` 分支；上传失败 |
| `models.ts` | 模型分类、能力字段、缓存 |
| `storage.ts` | v3→v4 迁移、非法字段丢弃、URL 校验、结果数量上限 |

### 11.2 集成测试

- 模拟 `fetch`：模型列表、上传、文本同步生成、图片/视频提交、任务查询。
- 模拟 WebSocket：`task.updated`、断线重连、漏事件补偿。
- 不新增 MSW 等依赖，使用 Vitest mock。

### 11.3 手动回归

| 场景 | 预期 |
| --- | --- |
| 无 token 生成 | 提示配置，不发请求 |
| 401 | 提示重新登录，不清空画布 |
| 模型列表失败 | 显示错误，保留上次选择 |
| 文本生成中取消 | 保留旧文本，状态 canceled |
| 文本生成中刷新 | 状态 failed，提示重新生成 |
| 图片生成中刷新 | 恢复等待并落图 |
| 视频失败 | 显示错误，可重试 |
| 删除生成中节点 | 停止本地等待，清理缓存 |
| 导入 v3 快照 | 正常打开 |
| 导出再导入 | 结果、提示词、模型、参数保留 |
| 1000 节点基准 | FPS 不退化 |

---

## 12. 文件变更清单

新增：

```text
src/lib/ai/config.ts
src/lib/ai/auth.ts
src/lib/ai/http.ts
src/lib/ai/realtime.ts
src/lib/ai/types.ts
src/lib/ai/models.ts
src/lib/ai/payload.ts
src/lib/ai/provider.ts
src/lib/ai/controller.ts
src/lib/ai/taskManager.ts
src/lib/ai/taskCache.ts
src/lib/ai/media.ts
src/lib/ai/refs.ts
src/lib/ai/providers/mock.ts
src/lib/ai/providers/text.ts
src/lib/ai/providers/image.ts
src/lib/ai/providers/video.ts
src/components/ai/GenerationPanel.tsx
src/components/ai/ModelSelect.tsx
src/components/ai/GenerationStatus.tsx
src/components/ai/AiSettingsDialog.tsx
src/components/nodes/VideoNode.tsx
src/lib/ai/*.test.ts
```

修改：

```text
src/types.ts                  # NodeKind / GenerationMeta / VideoData
src/lib/geometry.ts           # video 尺寸
src/lib/storage.ts            # schema v5 / sanitize / 迁移
src/components/FlowCanvas.tsx # nodeTypes / 视频节点
src/components/Toolbar.tsx    # 新增入口
src/components/ContextMenu.tsx
src/components/CommandPalette.tsx
src/components/nodes/TextNode.tsx
src/components/nodes/ImageNode.tsx
src/index.css                 # 面板/状态/视频节点样式
vite.config.ts                # dev 代理
README.md / ROADMAP.md
```

---

## 13. 待确认

1. **文本生成超时**：后端同步生成建议控制在 120s 内；若可能超过网关超时，需要改为异步 Task。当前方案按同步设计，客户端超时 300s。
2. **文本幂等语义**：同一 `clientRequestId` 已完成返回旧结果、进行中返回 `20006`，是否接受？
3. **鉴权**：token 由宿主注入，还是画布独立持有 API Key？推荐前者。
4. **实时通道**：是否实现 WebSocket + ticket？若后端第一版只提供轮询，`taskManager` 可只启用轮询。
5. **结果 URL 有效期**：是否需要图片镜像到 IndexedDB？视频建议只存 URL。
6. **视频音频**：是否需要 `generateAudio`？需要则模型能力补 `supportsAudio`。
7. **上传限制**：图片/视频大小、格式白名单由后端确认。
8. **任务取消**：图片/视频后端是否支持真正取消？不支持时前端只停止等待。

---

## 14. 当前实现说明

- 默认无 `VITE_AI_API_BASE_URL` 时启用 Mock，可直接体验文本/图片/视频三种节点。
- 文本节点走同步 `POST /v1/text/generations`，等待期间保留旧文本，成功后整体替换。
- 图片/视频任务支持 WebSocket `task.updated` 与 4s 轮询双通道，刷新后从任务缓存恢复。
- 点击文本/图片/视频生成节点，在节点上方或下方自动选择空间更充足的一侧弹出输入框浮窗；本地静态上传节点点击只选中，不弹窗。节点本身展示生成结果，生成中显示遮罩进度。
- 浮窗只保留提示词输入框；模型选择位于左下角，配置项在「生成设置」弹窗中，模式根据上游引用自动识别。
- 已实现：模型选择、自动模式、比例、分辨率、数量、时长、画质档、背景、负向提示词、结果历史、active 切换、取消等待、错误重试。
- 暂未实现：图片结果镜像到 IndexedDB、生成历史服务端同步。
- 修改 API Base/Token 后，模型列表需刷新页面或重新打开面板才会重新拉取。
