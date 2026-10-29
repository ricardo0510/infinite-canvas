# Infinite Canvas 后台管理系统开发文档

> 关联：`docs/backend-api-plan.md`、`server/`  
> 目标：给运营/管理员提供模型、Provider、任务、用户、队列和审计管理能力，不改变画布端现有交互。

---

## 1. 目标与边界

### 1.1 本期目标

- 管理员登录、角色权限、操作审计。
- 模型目录管理：新增/编辑/上下架/排序/能力与价格。
- Provider 管理：DeepSeek 等上游配置、连通性测试、密钥托管。
- 任务管理：查询、筛选、详情、取消、重试、失败排查。
- 用户与 API Token 管理：创建、禁用、撤销、配额与限流。
- 上传资源管理：查看、预览、删除、清理孤儿文件。
- 队列与实时监控：BullMQ 队列积压、失败任务、暂停/恢复、重试。
- 系统设置：默认模型、超时、上传限制、功能开关。
- 审计日志：谁在什么时间改了什么，敏感字段脱敏。

### 1.2 不在本期范围

- 画布协作、节点编辑、前端交互改造。
- 完整计费/发票系统（先预留积分与额度字段）。
- 复杂 BI、数据仓库、实时大屏。
- 面向普通用户的账号中心；普通用户仍使用 API Token。

---

## 2. 总体方案

### 2.1 推荐形态

```text
admin/                     # 独立 Vite + React 管理端
  src/
    api/                   # 管理 API 客户端
    pages/                 # Dashboard / Models / Providers / Tasks ...
    components/
    layouts/
server/src/admin/          # 管理 API 模块
  auth/                    # 登录、会话、CSRF
  models/                  # 模型目录 CRUD
  providers/               # Provider 配置与测试
  tasks/                   # 任务查询、取消、重试
  users/                   # 用户与 Token
  uploads/                 # 资源管理
  queue/                   # BullMQ 管理
  audit/                   # 审计日志
  settings/                # 系统设置
```

- 管理 API 与业务 API 复用同一个 NestJS 服务，路径统一为 `/v1/admin/*`。
- 管理端独立部署在 `admin.example.com` 或同域 `/admin`，不与画布端共用会话。
- 管理端与业务端使用不同的鉴权体系：业务用 `API_TOKEN`，管理端用管理员会话，互不通用。
- 若后续安全要求更高，可把 `server/src/admin` 拆成独立服务，接口契约不变。

### 2.2 技术选型

| 层 | 选择 | 说明 |
| --- | --- | --- |
| 管理端 | React 19 + Vite + TypeScript | 与画布端同语言 |
| UI | Ant Design 5 + 深色主题 | 表格、表单、弹窗、权限控制成熟 |
| 数据请求 | TanStack Query | 缓存、刷新、分页、错误重试 |
| 路由 | React Router | 页面级权限 |
| 表单 | Ant Design Form + Zod | 模型能力 JSON 需要额外校验 |
| 管理 API | NestJS + Prisma | 复用现有 envelope / filter / interceptor |
| 队列管理 | BullMQ API | `getJobCounts`、失败任务重试 |
| 审计 | PostgreSQL 追加表 | 不写对象存储，便于查询 |

不建议把管理端塞进画布端 `src/`；独立 `admin/` 子项目，避免权限、依赖和构建互相污染。

---

## 3. 权限模型

### 3.1 角色

| 角色 | 权限 |
| --- | --- |
| `viewer` | 只读 Dashboard、任务、模型、Provider 列表（密钥脱敏） |
| `operator` | 取消/重试任务、上下架模型、查看队列、查看上传 |
| `admin` | 模型/Provider CRUD、用户与 Token、设置、删除上传 |
| `superadmin` | 管理员账号、角色、审计导出、危险操作 |

### 3.2 权限点

```text
dashboard.read
model.read / model.write / model.publish
provider.read / provider.write / provider.test
task.read / task.cancel / task.retry
user.read / user.write / token.read / token.write
upload.read / upload.delete
queue.read / queue.retry / queue.pause
setting.read / setting.write
audit.read / audit.export
admin.read / admin.write
```

后端用 `@Roles()` + `AdminGuard` 校验；前端只做按钮隐藏，不能作为安全边界。

---

## 4. 管理员认证

### 4.1 登录方式

优先级建议：

1. 内部已有 SSO（飞书/OIDC/LDAP）→ 直接接 SSO，管理端不存密码。
2. 没有 SSO → 本地管理员账号 + Argon2id 密码哈希 + 可选 2FA。

### 4.2 会话

- 登录成功创建 `admin_sessions` 记录，返回 `HttpOnly + Secure + SameSite=Lax` 的 session cookie。
- 写操作要求 CSRF token（double-submit cookie 或 header）。
- 会话有效期建议 8 小时，空闲 30 分钟过期；支持“退出所有设备”。
- 登录失败限流：同一 IP/账号 5 次/5 分钟，触发短时锁定。
- 管理端 JWT/会话 audience 与业务 API Token 完全分离，禁止互相复用。

### 4.3 数据表

```prisma
model AdminUser {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String?
  role         String   @default("viewer")
  status       String   @default("active") // active / disabled
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model AdminSession {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
}
```

---

## 5. 功能模块

### 5.1 Dashboard

- 今日/近 7 天任务量、成功率、失败率、平均耗时。
- 队列：waiting / active / delayed / failed / completed。
- 模型调用排行、Provider 错误率、上传占用空间。
- 最近 10 条失败任务和审计事件。
- 数据来源：任务表聚合 + BullMQ `getJobCounts`。

### 5.2 模型管理

- 列表：ID、名称、类型、模式、Provider、状态、排序、更新时间。
- 编辑：
  - 基础信息：name、kind、modes、description、logoUrl。
  - 能力：limits、output.image、output.video、params。
  - Provider 绑定：providerId + providerModel。
  - 价格：baseCredits、perSecondCredits。
  - 上下架、排序。
- JSON 能力编辑需做 schema 校验，不能直接写坏 `output`。
- 模型变更后清理 60 秒缓存，确保 `/v1/models` 立即生效。
- 当前 `server/src/models/models.seed.ts` 是硬编码，需迁移到 `models` 表；管理端上线前先做这步。

建议表：

```prisma
model ModelConfig {
  id            String   @id
  name          String
  kind          String
  modes         Json
  description   String?
  logoUrl       String?
  limits        Json
  output        Json
  params        Json?
  pricing       Json?
  providerId    String?
  providerModel String?
  enabled       Boolean  @default(true)
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### 5.3 Provider 管理

- 列表：名称、类型、Base URL、模型映射、启用状态、并发、超时。
- 编辑：
  - `type`：`deepseek` / `openai` / `custom`。
  - `baseUrl`、`apiKey`、`model`、`timeoutMs`、`concurrency`。
  - `extra` JSON：自定义 header、组织 ID、代理等。
- 密钥：
  - 数据库只存加密后的密文，使用 KMS/主密钥加密。
  - 接口永远只返回 `apiKeyMasked`，不返回明文。
  - 更新时留空表示“不修改”，不能把掩码写回。
- 连通性测试：`POST /v1/admin/providers/:id/test`，发最小请求验证 key/base/model。
- 当前 DeepSeek 走环境变量；管理端上线后改为读取 Provider 配置，环境变量作为 fallback。

建议表：

```prisma
model ProviderConfig {
  id             String   @id @default(uuid())
  name           String
  type           String
  baseUrl        String
  apiKeyEncrypted String?
  model          String?
  timeoutMs      Int      @default(120000)
  concurrency    Int      @default(4)
  extra          Json?
  enabled        Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### 5.4 任务管理

- 列表筛选：用户、kind（text/image/video）、status、modelId、日期范围、taskId、clientRequestId。
- 列：taskId、kind、model、status、progress、耗时、创建时间、用户。
- 详情：
  - 请求：prompt、params、references（URL 可预览）。
  - 结果：文本/图片/视频预览、usage、finishReason。
  - 错误：code、message、上游错误摘要。
  - 时间线：created / running / terminal 事件。
- 操作：
  - 取消：调用现有 `POST /v1/tasks/:id/cancel`。
  - 重试：以原请求创建新任务，新 `clientRequestId`，记录 `retriedFrom`。
  - 批量取消/重试：最多 50 条，逐条返回结果。
- 隐私：prompt/结果可能含用户内容；默认只对 `admin` 以上可见，审计记录查看行为。
- 失败重试不建议直接改原任务，保持任务不可变历史。

建议给 Task 增加：

```text
adminNote    String?
retriedFrom  String?
```

### 5.5 用户与 API Token

当前只有单个 `API_TOKEN`，管理端上线前需要补用户与 Token 表：

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ApiToken {
  id         String    @id @default(uuid())
  userId     String
  name       String
  tokenHash  String    @unique
  lastUsedAt DateTime?
  expiresAt  DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
}
```

管理能力：

- 创建用户、禁用用户。
- 创建/撤销/轮换 Token；Token 明文只在创建时显示一次。
- 查看最近使用时间、关联任务数。
- 配额/限流预留：`dailyTaskLimit`、`concurrentTaskLimit`。
- 删除用户前处理其未终态任务：取消或阻止删除。

### 5.6 上传资源

- 列表：文件名、MIME、大小、宽高、owner、hash、创建时间、URL。
- 预览图片/视频。
- 删除：同时删除对象存储文件；被任务引用时二次确认。
- 孤儿清理：超过 N 天且无任务引用；提供 dry-run 预览。
- 当前上传落本地 `server/uploads`；上 S3 后增加 `Upload` 表并记录 storageKey。

### 5.7 队列与实时

- 队列统计：`getJobCounts()`。
- 失败任务列表：jobId、taskId、失败原因、时间。
- 操作：重试单个/批量失败 job、移除失败 job、暂停/恢复队列。
- 并发调整：写环境/配置前先说明需重启 Worker 或动态生效范围。
- 实时连接：当前票据在内存，只能显示当前实例连接数；多实例需 Redis 统计或先不做。
- 危险操作（暂停队列、清空失败 job）要求 `admin` 以上并写审计。

### 5.8 系统设置

- 默认模型：按 kind 选择默认模型。
- 任务超时、上传大小、队列并发。
- 功能开关：是否允许文本/图片/视频生成。
- 设置存 `Setting` 表，变更写审计；不要通过管理端直接改 `.env`。
- 密钥类配置统一走 Provider 管理，不放 Setting。

### 5.9 审计日志

记录所有写操作：

```text
id, actorId, actorEmail, action, targetType, targetId,
before, after, ip, userAgent, requestId, createdAt
```

- `before/after` 中的 `apiKey`、`token`、`password` 必须脱敏。
- 只追加，不提供修改/删除接口；保留 180 天。
- 支持按操作人、动作、目标、时间筛选和 CSV 导出。

---

## 6. 管理 API 设计

统一前缀：`/v1/admin`。沿用 `{ code, message, data }` 响应和现有异常过滤器。

### 6.1 认证

```http
POST /v1/admin/auth/login
POST /v1/admin/auth/logout
GET  /v1/admin/auth/me
```

登录请求：

```json
{ "email": "admin@example.com", "password": "..." }
```

登录成功写 session cookie；响应只返回管理员信息与权限点。

### 6.2 模型

```http
GET    /v1/admin/models
POST   /v1/admin/models
GET    /v1/admin/models/:id
PATCH  /v1/admin/models/:id
DELETE /v1/admin/models/:id
POST   /v1/admin/models/:id/publish
POST   /v1/admin/models/:id/unpublish
```

列表支持 `kind`、`enabled`、`q`、`page`、`pageSize`。

### 6.3 Provider

```http
GET    /v1/admin/providers
POST   /v1/admin/providers
PATCH  /v1/admin/providers/:id
DELETE /v1/admin/providers/:id
POST   /v1/admin/providers/:id/test
```

`GET` 返回 `apiKeyMasked`，不返回密文和明文。

### 6.4 任务

```http
GET  /v1/admin/tasks
GET  /v1/admin/tasks/:taskId
POST /v1/admin/tasks/:taskId/cancel
POST /v1/admin/tasks/:taskId/retry
POST /v1/admin/tasks/batch-cancel
POST /v1/admin/tasks/batch-retry
```

列表分页返回：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

### 6.5 用户与 Token

```http
GET    /v1/admin/users
POST   /v1/admin/users
PATCH  /v1/admin/users/:id
GET    /v1/admin/users/:id/tokens
POST   /v1/admin/users/:id/tokens
DELETE /v1/admin/users/:id/tokens/:tokenId
```

### 6.6 上传

```http
GET    /v1/admin/uploads
DELETE /v1/admin/uploads/:id
POST   /v1/admin/uploads/prune
```

### 6.7 队列

```http
GET  /v1/admin/queue/stats
GET  /v1/admin/queue/failed
POST /v1/admin/queue/jobs/:jobId/retry
POST /v1/admin/queue/retry-all
POST /v1/admin/queue/pause
POST /v1/admin/queue/resume
```

### 6.8 设置与审计

```http
GET  /v1/admin/settings
PUT  /v1/admin/settings
GET  /v1/admin/audit-logs
GET  /v1/admin/audit-logs/export
```

### 6.9 Dashboard

```http
GET /v1/admin/dashboard/overview
```

返回任务量、成功率、队列 counts、模型排行、最近失败任务。

---

## 7. 管理端页面

```text
/admin/login
/admin/dashboard
/admin/models
/admin/models/:id
/admin/providers
/admin/providers/:id
/admin/tasks
/admin/tasks/:taskId
/admin/users
/admin/users/:id
/admin/uploads
/admin/queue
/admin/audit
/admin/settings
```

组件建议：

- `AdminLayout`：侧边导航 + 顶栏 + 退出登录。
- `DataTable`：分页、筛选、空态、错误态。
- `JsonEditor`：模型能力/Provider extra 的 JSON 校验与格式化。
- `StatusTag`：任务/队列状态颜色统一。
- `ConfirmDanger`：危险操作二次确认，要求输入任务 ID 或模型 ID。
- `SecretField`：只显示掩码，更新时留空不修改。
- `Permission`：按权限点隐藏按钮。

视觉上使用 Ant Design 深色主题即可；不需要复用画布端的 CSS token，避免管理端被业务样式拖累。

---

## 8. 安全要求

- 管理端独立域名/端口，生产必须 HTTPS。
- session cookie 必须 `HttpOnly + Secure + SameSite=Lax`；写操作校验 CSRF。
- 管理 API 不走 `API_TOKEN`，使用独立 `AdminGuard`。
- 登录限流、失败锁定、可选 2FA；管理员密码 Argon2id。
- Provider 密钥加密存储，接口只返回掩码；日志、审计、错误信息全部脱敏。
- 危险操作（删模型、删 Provider、清队列、暂停队列）要求 `admin`/`superadmin`。
- 审计不可篡改；建议独立数据库账号只允许 insert。
- 管理端生产构建不要暴露 sourcemap。
- 可选：IP 白名单、VPN、SSO 强制。

---

## 9. 数据迁移与实施顺序

### 9.1 迁移

1. 新增 `AdminUser/AdminSession/AuditLog/Setting/ModelConfig/ProviderConfig/User/ApiToken` 表。
2. 把 `models.seed.ts` 的 3 个模型和 DeepSeek 配置导入 `ModelConfig/ProviderConfig`。
3. 业务 `/v1/models` 改为读 `ModelConfig` + 60 秒缓存；环境变量 Provider 作为 fallback。
4. 业务鉴权从单 `API_TOKEN` 迁移到 `ApiToken` 表；保留 `API_TOKEN` 兼容开关。

### 9.2 阶段计划

| 阶段 | 内容 | 预估 |
| --- | --- | --- |
| A0 | 管理端脚手架、登录、会话、AdminGuard、布局 | 2–3 天 |
| A1 | Dashboard 只读 + 模型列表只读 | 1–2 天 |
| A2 | 模型/Provider CRUD + 密钥托管 + 连通性测试 | 3–5 天 |
| A3 | 任务列表/详情/取消/重试 + 用户与 Token | 3–5 天 |
| A4 | 上传、队列、设置、审计 | 3–5 天 |
| A5 | SSO/2FA、S3、监控、压测 | 3–5 天 |

建议先做 A0–A1，让运营能看到任务和模型状态；A2 再做写入操作。

---

## 10. 测试计划

- 认证：登录失败限流、会话过期、CSRF、退出所有设备。
- RBAC：viewer 不能写、operator 不能改 Provider、admin 不能改 superadmin。
- 模型：JSON 能力校验、上下架、缓存失效、非法 kind/mode。
- Provider：密钥不回显、更新留空不覆盖、测试连接失败提示。
- 任务：筛选分页、取消、重试生成新任务、批量上限、审计记录。
- 队列：暂停后 API 仍可入队、恢复后消费、失败 job 重试。
- 安全：密钥不出现在日志/审计/响应、危险操作二次确认。
- E2E：登录 → Dashboard → 模型编辑 → 任务重试 → 审计可查。

---

## 11. 待确认

1. 管理端登录接飞书/OIDC 还是本地账号？
2. 管理端部署域名：`admin.example.com` 还是同域 `/admin`？
3. 是否需要 2FA/IP 白名单？
4. 任务 prompt/结果对管理员的可见范围与保留时长。
5. Provider 密钥使用 KMS、Vault 还是应用主密钥加密？
6. 是否需要积分/配额管理进入本期。
7. 上传是否本期切 S3/OSS；如果切，需先补 `Upload` 表。
8. 队列管理是否允许在线调整并发，还是只读 + 重启生效。

---

## 12. 交付物

- `admin/` 可运行管理端。
- `server/src/admin/` 管理 API 模块与 Prisma 迁移。
- 管理员/角色/会话/审计/设置表。
- 模型与 Provider 从配置文件迁移到数据库。
- 管理 API 的契约测试与 Playwright 冒烟测试。
- 部署说明：环境变量、CORS、Cookie 域名、反向代理、备份策略。
