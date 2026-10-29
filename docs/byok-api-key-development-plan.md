# 用户 API Key 托管（BYOK）开发文档

> 关联：`docs/backend-api-plan.md`、`docs/admin-system-development-plan.md`、`server/`
> 目标：平台维护供应商目录，用户选择供应商、填写自己的 API Key；Key 加密保存在服务器，模型列表从供应商动态获取，用户选择模型后直接生成。

---

## 1. 需求定义

### 1.1 产品流程

```text
用户登录
  -> 选择平台提供的供应商（DeepSeek / OpenAI / Anthropic / SiliconFlow ...）
  -> 填写该供应商的 API Key
  -> 后端测试 Key、拉取模型列表
  -> 用户勾选模型，设置文本/图片/视频默认模型
  -> 画布生成时按 modelId 路由到对应供应商和用户 Key
```

### 1.2 明确规则

- 供应商列表由平台维护，用户不能随意新增未知供应商。
- 模型列表由供应商接口动态获取，平台可做白名单和能力映射。
- API Key 保存在服务器，加密存储，不返回明文。
- 前端不持久化 Key；换设备登录同一账号即可继续使用。
- 一个用户可以给同一个供应商保存多个 Key（不同账号/区域）。
- 用户只能访问自己的 Key，管理员只能看状态和掩码，不能看明文。
- 图片/视频任务由 Worker 执行，Worker 从数据库读取加密 Key 并解密，Key 不进入 BullMQ job payload。

---

## 2. 当前状态与缺口

当前后端已有：

- `ProviderConfig` / `ModelConfig` 表。
- 平台级 DeepSeek Key 通过环境变量读取。
- 单 `API_TOKEN` 鉴权，没有用户体系。
- 文本/图片/视频统一异步任务 + BullMQ + WebSocket。
- AdminJS 管理 Provider/Model 配置。

要做 BYOK，必须先补：

1. 用户体系与用户级鉴权。
2. `UserProviderCredential` 表。
3. Key 加密/解密模块。
4. 供应商适配器接口。
5. 模型同步与用户模型偏好。
6. Worker 按 `credentialId` 读取 Key 的流程。
7. Key 状态、失效、轮换和审计。

---

## 3. 总体架构

```text
浏览器
  │ 1. 登录 / 选择供应商 / 提交 API Key
  ▼
API
  ├── UserProviderCredential（加密存储）
  ├── ProviderConfig（平台供应商目录）
  ├── ProviderModel（供应商模型目录）
  └── 入队 task { providerId, providerModel, credentialId }
        │
        ▼
      Redis / BullMQ
        │
        ▼
      Worker
        ├── 读取 credentialId
        ├── 解密 Key（仅内存）
        ├── ProviderAdapter 调上游
        └── 写结果 / 发 WebSocket 事件
                     │
                     ▼
                  PostgreSQL
```

关键点：**任务表只存 `credentialId`，不存 Key、不存密文。**

---

## 4. 用户与鉴权前提

当前只有单个 `API_TOKEN`，无法区分用户，必须先做用户体系。

最小模型：

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String?  @unique
  status    String   @default("active") // active / disabled
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ApiToken {
  id         String    @id @default(uuid())
  userId     String
  name       String
  tokenHash  String    @unique
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
}
```

- 前端登录后拿到用户身份。
- 所有 `/v1/*` 生成接口从 token 解析 `userId`。
- BYOK 相关接口必须登录，不能匿名。
- 如果暂时没有正式账号体系，可以先用 `API_TOKEN -> userId` 映射过渡，但不支持多用户 Key。

---

## 5. 数据模型

### 5.1 ProviderConfig（扩展现有表）

```prisma
model ProviderConfig {
  id              String   @id @default(uuid())
  name            String
  type            String   // deepseek / openai / anthropic / custom / openai-compatible
  adapter         String   // deepseek / openai-compatible / anthropic / ...
  baseUrl         String
  docsUrl         String?
  authType        String   @default("bearer") // bearer / x-api-key
  supportsModels  Boolean  @default(true)
  enabled         Boolean  @default(true)
  extra           Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

说明：

- `baseUrl` 只由平台维护，不允许用户填写，直接消除 SSRF 风险。
- 企业私有网关可单独增加一个 `custom` Provider，但需要管理员审核/白名单。
- `adapter` 决定用哪个适配器实现。

### 5.2 ProviderModel

```prisma
model ProviderModel {
  id            String   @id @default(uuid())
  providerId    String
  modelId       String   // 供应商返回的模型 ID
  displayName   String
  kind          String   // text / image / video
  capabilities  Json?    // context、ratio、resolution、duration、audio...
  source        String   @default("sync") // sync / manual
  enabled       Boolean  @default(true)
  lastSyncedAt  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([providerId, modelId])
}
```

- 文本模型通常能从 `/models` 获取 ID，能力字段需要平台补充。
- 图片/视频供应商很多没有 `/models`，使用 `source=manual` 的静态配置。
- 新同步到的未知模型默认 `enabled=false`，管理员确认能力后再开放。

### 5.3 UserProviderCredential

```prisma
model UserProviderCredential {
  id             String    @id @default(uuid())
  userId         String
  providerId     String
  label          String    @default("默认")
  apiKeyEncrypted String
  keyVersion     Int       @default(1)
  keyMask        String    // sk-...a1b2
  status         String    @default("active") // active / invalid / revoked
  lastVerifiedAt DateTime?
  lastUsedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([userId, providerId])
  @@unique([userId, providerId, label])
}
```

规则：

- 同一用户同一供应商可多份 Key。
- `keyMask` 只用于展示。
- `status=invalid` 时禁止用于新任务，并提示用户更新。
- 删除采用软删除/revoked，避免历史任务无法追溯。

### 5.4 UserModelPreference

```prisma
model UserModelPreference {
  id              String   @id @default(uuid())
  userId          String
  providerModelId String
  enabled         Boolean  @default(true)
  isDefault       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, providerModelId])
}
```

用于记录用户勾选了哪些模型、默认模型是谁。

---

## 6. Key 加密设计

### 6.1 原则

- 数据库永远不存明文 Key。
- 接口永远不返回明文，只返回 `keyMask`。
- 日志、审计、错误信息、BullMQ job payload 都不允许出现 Key。
- 解密只发生在 API/Worker 处理请求的内存中。

### 6.2 加密方式

推荐信封加密：

```text
KEK（KMS/Vault/主密钥）
  └── 加密 DEK
        └── 加密用户 API Key
```

- 算法：AES-256-GCM。
- 每条凭据生成随机 DEK 和 IV。
- 存储：`ciphertext + iv + authTag + keyVersion`。
- AAD 建议包含 `userId + providerId + credentialId`，防止密文被挪用到别的用户。
- 生产环境 KEK 放 KMS/Vault；本地开发可用 `KEY_ENCRYPTION_SECRET`。
- 支持 keyVersion，便于主密钥轮换。

### 6.3 代码接口

```ts
type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

interface SecretCipher {
  encrypt(plain: string, aad: string): Promise<EncryptedSecret>;
  decrypt(secret: EncryptedSecret, aad: string): Promise<string>;
  mask(plain: string): string;
}
```

- `mask("sk-1234567890abcd")` -> `sk-...abcd`
- 解密失败返回 `ApiException(50000, "凭据解密失败")`，不要返回底层错误。
- 不要在异常堆栈里拼接明文。

---

## 7. 供应商适配器

### 7.1 接口

```ts
type ProviderContext = {
  baseUrl: string;
  apiKey: string;
  extra?: Record<string, unknown>;
};

interface ProviderAdapter {
  listModels(ctx: ProviderContext): Promise<ProviderModelInfo[]>;
  testKey(ctx: ProviderContext): Promise<{ ok: boolean; message?: string }>;

  generateText?(
    ctx: ProviderContext,
    input: TextInput,
  ): Promise<{ text: string; usage?: Usage; finishReason?: string }>;

  submitImage?(
    ctx: ProviderContext,
    input: ImageInput,
  ): Promise<{ providerTaskId: string }>;

  pollImage?(
    ctx: ProviderContext,
    providerTaskId: string,
  ): Promise<ProviderTaskUpdate>;

  submitVideo?(
    ctx: ProviderContext,
    input: VideoInput,
  ): Promise<{ providerTaskId: string }>;

  pollVideo?(
    ctx: ProviderContext,
    providerTaskId: string,
  ): Promise<ProviderTaskUpdate>;
}
```

### 7.2 适配器规划

| 适配器 | 覆盖 |
| --- | --- |
| `openai-compatible` | OpenAI、DeepSeek、SiliconFlow、Groq、Together、OneAPI、LiteLLM、vLLM |
| `anthropic` | Claude 系列 |
| `google` | Gemini 系列 |
| `custom` | 企业私有网关，管理员审核 |

第一版优先实现 `openai-compatible`，它已经能覆盖大部分文本模型。

### 7.3 模型列表

- 文本：`GET {baseUrl}/models`，按返回 ID 建立 `ProviderModel`。
- 图片/视频：如果供应商没有模型列表接口，使用 `ProviderModel(source=manual)` 静态配置。
- 能力归一化统一到 `capabilities` JSON：
  - 文本：context window、max output tokens、streaming、tools。
  - 图片：aspect ratios、resolutions、max count。
  - 视频：aspect ratios、resolutions、min/max duration、audio。
- 同步失败时保留旧列表，不删除已有模型。

---

## 8. API 设计

沿用 `{ code, message, data }` 和 Bearer 鉴权。所有接口都必须登录。

### 8.1 供应商

```http
GET /v1/providers
```

返回平台维护的供应商，不含任何 Key。

```json
{
  "providers": [
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "adapter": "openai-compatible",
      "authType": "bearer",
      "supportsModels": true,
      "docsUrl": "https://api-docs.deepseek.com"
    }
  ]
}
```

### 8.2 添加/更新 Key

```http
POST /v1/providers/{providerId}/credentials
Content-Type: application/json

{
  "label": "默认",
  "apiKey": "sk-..."
}
```

响应只返回掩码：

```json
{
  "id": "cred_123",
  "providerId": "deepseek",
  "label": "默认",
  "keyMask": "sk-...a1b2",
  "status": "active",
  "lastVerifiedAt": "2026-10-29T08:00:00Z"
}
```

```http
PATCH  /v1/providers/{providerId}/credentials/{credentialId}
DELETE /v1/providers/{providerId}/credentials/{credentialId}
```

- `PATCH` 可更新 label 或替换 Key；请求里 `apiKey` 为空表示不修改。
- `DELETE` 标记 revoked；如果还有未终态任务，返回 `20005` 或先取消任务。

### 8.3 测试 Key

```http
POST /v1/providers/{providerId}/credentials/{credentialId}/test
```

- 后端解密 Key，调用供应商 `/models` 或最小请求。
- 成功更新 `lastVerifiedAt`、`status=active`。
- 401/403 标记 `status=invalid`，返回明确提示。
- 不在响应或日志中回显 Key。

### 8.4 模型同步与选择

```http
POST /v1/providers/{providerId}/models/sync
GET  /v1/providers/{providerId}/models
```

`sync` 需要用户已绑定 Key；后端用该 Key 拉模型列表并 upsert。

```http
GET /v1/user/models
PUT /v1/user/models
```

`PUT` 请求：

```json
{
  "models": [
    { "providerModelId": "pm_1", "enabled": true, "isDefault": true },
    { "providerModelId": "pm_2", "enabled": true, "isDefault": false }
  ]
}
```

- 每个 kind 最多一个默认模型。
- 未绑 Key 的供应商模型不可启用。
- 前端模型选择器只展示用户已启用的模型。

### 8.5 生成接口保持不变

```http
POST /v1/text/generations
POST /v1/image/generations
POST /v1/video/generations
```

请求里的 `modelId` 使用 `ProviderModel.modelId` 或平台统一 ID。  
关键变化：

- 不再从前端传 Key。
- 后端根据 `modelId` 找到 `ProviderModel -> ProviderConfig`。
- 再根据当前用户找到 `UserProviderCredential`。
- 任务记录只保存 `credentialId`，不保存 Key。

---

## 9. 任务执行流程

```text
1. 用户提交生成请求 { modelId, prompt, ... }
2. API 校验 modelId 属于用户已启用的 ProviderModel
3. API 找到该用户的 credentialId
4. 写入 task:
   {
     userId,
     providerId,
     providerModel,
     credentialId,
     request
   }
5. 入队 BullMQ
6. Worker 读取 task
7. Worker 用 credentialId 查凭据，解密 Key
8. Worker 调用 ProviderAdapter
9. 图片/视频继续用同一个 Key 轮询上游
10. 终态写结果，更新 lastUsedAt
11. job payload 中没有 Key，Worker 日志中没有 Key
```

### 9.1 Key 失效

Worker 遇到上游 401/403：

1. 将 `UserProviderCredential.status` 标记为 `invalid`。
2. 任务失败，错误码建议 `30001`，文案「API Key 已失效，请重新绑定」。
3. 不再自动重试该任务。
4. WebSocket 推送失败终态。

### 9.2 Key 删除/轮换

- 删除时检查该凭据下是否有 `queued/running` 任务。
- 有任务时返回 `20005`，要求先取消或等待结束。
- 替换 Key 时生成新的 `keyVersion` 和密文，旧密文不保留。
- 已运行任务可继续使用内存中的旧 Key 完成，或直接失败；建议失败并提示。

---

## 10. 前端交互

### 10.1 AI 设置新增「我的供应商」

```text
供应商卡片
  DeepSeek
    状态：已绑定 sk-...a1b2 / 未绑定 / 已失效
    操作：绑定 Key / 测试 / 替换 / 删除

  OpenAI
    未绑定
```

绑定弹窗：

```text
供应商：DeepSeek（只读）
备注：默认
API Key：••••••••
[测试连接] [保存]
```

保存成功后：

- 自动调用模型同步。
- 展示模型勾选列表。
- 用户选择默认文本/图片/视频模型。

### 10.2 模型选择

- 按供应商分组。
- 显示模型类型与能力摘要。
- 未启用/未绑定 Key 的模型置灰。
- 支持刷新模型列表。
- 用户只看到自己启用的模型。

### 10.3 Key 状态

- `active`：可用。
- `invalid`：上游拒绝，提示重新绑定。
- `revoked`：已删除。
- 页面只显示掩码，不提供“查看明文”。

### 10.4 换设备

Key 在服务器，登录同一账号即可直接使用，不需要重新绑定。  
如果使用匿名/API_TOKEN 模式，则仍按单账号处理，换设备需要重新配置。

---

## 11. 安全要求

- 所有 BYOK 接口必须登录，禁止匿名。
- Key 加密存储，接口只返回掩码。
- 日志和错误信息中禁止出现 `apiKey`、`Authorization`、密文。
- Fastify logger 配置 redact：
  ```ts
  redact: ["req.headers.authorization", "req.body.apiKey"]
  ```
- 生产环境使用 KMS/Vault 管理 KEK，不把主密钥写进代码/仓库。
- Provider `baseUrl` 只由平台维护，用户不能填写任意 URL，避免 SSRF。
- 如果开放自定义 Base URL，必须：
  - 仅允许 https；
  - 禁止 localhost、内网 IP、非 80/443 端口；
  - DNS 解析后校验 IP；
  - 管理员审核。
- 对 Key 测试接口限流，防止拿平台当“Key 探测器”。
- 审计记录：创建、替换、删除、测试、失效，不记录 Key 明文。
- 内容数据会发送给第三方供应商，前端应提示用户。

---

## 12. 管理端

AdminJS 增加只读/管理能力：

- ProviderConfig：名称、adapter、baseUrl、enabled。
- ProviderModel：模型 ID、kind、能力、enabled。
- 用户凭据统计：绑定数、invalid 数、最近使用时间，不展示 Key。
- 审计：谁在什么时候创建/删除/测试了凭据。
- 管理员不能“查看明文 Key”，只能触发用户重新绑定。

---

## 13. 迁移计划

### 13.1 数据库

1. 新增 `User`、`ApiToken`（如果还没有）。
2. 扩展 `ProviderConfig`：adapter、authType、docsUrl。
3. 新增 `ProviderModel`、`UserProviderCredential`、`UserModelPreference`。
4. 把现有 `ModelConfig` 的平台模型迁移成 `ProviderModel`，或保留 `ModelConfig` 作为平台模型，二者并存过渡。

### 13.2 兼容

- 平台 Key（环境变量/ProviderConfig）继续作为 fallback。
- 用户没有绑定 Key 时，只能使用平台模型。
- 用户绑定 Key 后，可以使用自己的模型。
- 生成时按 `modelId` 判断走平台 Key 还是用户 Key。

---

## 14. 实施阶段

| 阶段 | 内容 | 预估 |
| --- | --- | --- |
| B0 | User/ApiToken 鉴权、用户上下文 | 2–3 天 |
| B1 | ProviderConfig 扩展、ProviderModel、模型同步 | 2–3 天 |
| B2 | SecretCipher、UserProviderCredential、Key CRUD/测试 | 3–4 天 |
| B3 | OpenAI-compatible 适配器、文本 BYOK | 3–5 天 |
| B4 | 图片/视频 BYOK、Worker 凭据读取 | 4–6 天 |
| B5 | 前端绑定/模型选择、失效处理、管理端 | 3–5 天 |
| B6 | 审计、轮换、限流、压测 | 2–3 天 |

第一版建议 B0–B3：先把文本 BYOK 跑通，图片/视频继续平台 Key。

---

## 15. 测试计划

- 加密：加密/解密 roundtrip、错误 AAD、错误 keyVersion、密文篡改。
- 接口：创建 Key 后响应不含明文；日志不含 Key；不同用户不能读取彼此凭据。
- 模型同步：有效 Key 获取模型；401 标记 invalid；供应商无 `/models` 时使用静态目录。
- 生成：文本 BYOK 成功；Key 失效任务失败；Key 删除/轮换后的任务行为。
- Worker：job payload 不含 Key；Worker 能按 credentialId 解密；终态更新 lastUsedAt。
- 安全：401/403、限流、SSRF、越权访问、审计记录。
- E2E：绑定 Key → 同步模型 → 选择模型 → 画布生成 → 换设备登录复用。

---

## 16. 待确认

1. 用户体系使用现有账号、API Token 还是 Feishu/OIDC？
2. KEK 使用 KMS、Vault 还是应用主密钥？
3. 是否允许自定义 Base URL？如果允许，审核流程是什么？
4. 一个供应商是否需要多份 Key？默认支持多份。
5. 图片/视频第一版是否也走 BYOK，还是先平台 Key？
6. 模型能力字段由谁维护：自动同步 + 管理员补充，还是只做静态目录？
7. Key 失效后是否自动禁用该用户所有相关模型？

---

## 17. 验收标准

- 用户能选择供应商、绑定 Key、测试成功。
- 模型列表从供应商获取并按用户选择展示。
- Key 只以密文存在于数据库，任何接口/日志都拿不到明文。
- 文本生成可按用户 Key 调用供应商。
- 图片/视频任务 Worker 能按 `credentialId` 解密并使用 Key。
- 换设备登录同一账号无需重新绑定。
- 删除/失效 Key 后，相关任务给出明确错误，不产生无限重试。
- 管理端可查看供应商、模型和凭据状态，但看不到明文 Key。
