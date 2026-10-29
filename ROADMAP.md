# Infinite Canvas 开发规划

> 目标：做一个**可长期维护、可展示、可开源**的无限画布编辑器。
> 当前版本：`v0.2.0-dev`（编辑器基础，基于 `v0.1.0` / commit `2c92671`）
> 仓库：<https://github.com/ricardo0510/infinite-canvas>

---

## 1. 项目定位

**一句话**：Local-first 的无限画布编辑器，面向笔记、流程图、灵感整理和 AI 工作流的前端底座。

**核心原则**

- **本地优先**：默认不上传数据，localStorage / IndexedDB 即可工作。
- **小核心、可扩展**：画布引擎、状态、存储、节点类型彼此解耦，方便加新节点和插件。
- **可展示**：每个阶段都有可运行 Demo 和截图，能直接放进简历/作品集。
- **不过度设计**：先解决真实编辑体验，再考虑协作和 AI。

**目标用户**

1. 需要快速画流程图/思维导图的个人用户。
2. 想二次开发画布产品的开发者。
3. 面试官/开源用户：看代码结构、交互细节和工程质量。

**非目标（v1.0 前不做）**

- 不做完整 Miro/Figma 替代品。
- 不做账号体系、云端同步、计费。
- 不在核心稳定前做多人协作和 AI 自动执行。
- 不追求移动端完整编辑体验，先保证桌面端。

---

## 2. 当前基线（v0.1.0）

**技术栈**

| 层 | 选型 |
| --- | --- |
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 画布 | @xyflow/react 12 |
| 状态 | Zustand 5 |
| 样式 | 原生 CSS + CSS Variables |
| 质量 | oxlint + `tsc -b` |

**已实现**

- 无限平移/缩放、MiniMap、Controls、Fit View
- 自定义 Note 节点：标题/正文直接编辑、4 种强调色
- 拖拽、连线、多选、框选
- 撤销/重做（50 步）、复制/粘贴、Ctrl+D 复制
- localStorage 自动保存（400ms debounce）
- JSON 导入/导出
- 快捷键：撤销/重做/复制/粘贴/删除/保存
- 状态栏：节点数、连线数、缩放比例

**代码结构**

```
src/
  components/
    FlowCanvas.tsx        # React Flow 容器、右键/辅助线/浮层
    Toolbar.tsx           # 新建节点、撤销、布局、吸附、导入导出
    SelectionToolbar.tsx  # 对齐/分布/成组
    ContextMenu.tsx       # 右键菜单
    KeyboardHelp.tsx      # 快捷键面板（?）
    EmptyState.tsx        # 空画布引导
    StatusBar.tsx         # 节点/连线/缩放状态
    nodes/                # Note / Text / Image / Group
  hooks/
    useAutoSave.ts        # 订阅 store，防抖写 localStorage
    useCanvasShortcuts.ts
  lib/
    storage.ts            # schema v2、校验、迁移、导入导出
    geometry.ts           # 尺寸、绝对坐标、后代节点
    guides.ts             # 对齐辅助线计算
    layout.ts             # Dagre 自动布局（按需加载）
  store/
    canvasStore.ts        # nodes/edges/history/clipboard
    uiStore.ts            # 吸附开关、帮助面板
  types.ts
  App.tsx / main.tsx / styles/
```

**当前构建指标**

- 首屏 JS：471 KB（gzip 146 KB）；Dagre 自动布局单独分包 47 KB（gzip 16 KB）
- CSS：36.3 KB（gzip 6.8 KB）
- 首次加载未做路由/代码分割，重依赖（Dagre）已按需加载
- 性能（headless Chrome，1440×900）：500 节点 setup 323ms / 拖动 60.1 FPS；1000 节点 setup 326ms / 拖动 59.7 FPS；可见 DOM 约 15 个节点

**已知限制**

- 没有形状节点。
- 历史记录基于快照，节点很多时内存会增长。
- 快照存 localStorage，图片存 IndexedDB；清站点数据仍会全部丢失。
- 没有 E2E、License。
- 可访问性和移动端只做了基础处理。

---

## 3. 架构与扩展点

### 3.1 数据流

```
用户操作
  → React Flow 事件（onNodesChange / onConnect / onNodeDragStart）
  → Zustand store（applyNodeChanges / commit / history）
  → 受控 nodes / edges
  → React Flow 重渲染

store 变化
  → useAutoSave 订阅
  → debounce 400ms
  → localStorage
```

### 3.2 状态职责

| 状态 | 归属 | 说明 |
| --- | --- | --- |
| `nodes` / `edges` | canvasStore | 唯一数据源，React Flow 受控 |
| `past` / `future` | canvasStore | 快照历史，最多 50 步 |
| `clipboard` | canvasStore | 内部复制/粘贴，不依赖系统剪贴板 |
| 视口 | React Flow | 不放进 store，避免高频重渲染 |
| 选中态 | node/edge 的 `selected` | 由 React Flow 维护 |
| 持久化 | storage.ts | 版本化 JSON，后续可换 IndexedDB |

### 3.3 扩展点

- **新节点类型**：新增 `components/nodes/XxxNode.tsx`，注册到 `nodeTypes`，在 `types.ts` 增加 data 类型。
- **新边类型**：`edgeTypes` + `defaultEdgeOptions`。
- **新工具**：Toolbar 加按钮，store 加 action。
- **存储适配器**：`lib/storage.ts` 抽成 `StorageAdapter`，支持 localStorage / IndexedDB / 文件。
- **命令系统**：后续把 Toolbar/快捷键统一成 command registry，方便做命令面板和撤销分组。

---

## 4. 路线图

### v0.2 — 编辑器基础（1–2 周）

**目标**：从“能画”到“好用”。

- [x] 新增节点类型：Text、Image、Group
- [x] 右键菜单：新建节点、复制、删除、置顶/置底
- [x] 选中工具栏：批量删除、对齐、分布、成组
- [x] 网格吸附（8px）+ 智能对齐吸附（6px/缩放，多选包围盒）
- [x] 视口持久化、缩放预设、小地图开关
- [x] 连线校验（自连/重复）、悬停删除、拖到空白创建节点并自动连接
- [x] 分组拖入/拖出，分组自动扩展容纳新节点
- [x] 自动布局（Dagre）：一键整理（按需加载）
- [x] 边标签/边样式（颜色、虚线、箭头）
- [x] 节点尺寸持久化与最小尺寸约束
- [x] 快捷键面板（`?` 打开）
- [x] 空画布引导 + 流程图/思维导图/看板/会议模板
- [x] 命令面板（`/`）

**验收**：新建/编辑/连线/分组/整理 5 条主流程无阻塞；刷新后布局不丢；`npm run build` + `lint` 通过。

### v0.3 — 数据与稳定性（1–2 周）

**目标**：数据不丢，版本可升级，性能可量化。

- [x] Schema 版本号 + 迁移函数（v1/v2 → v3）
- [x] IndexedDB 存储适配器（图片 Blob，data URL 自动迁移与孤儿清理）
- [ ] 历史记录改为增量 patch 或压缩快照（控制内存）
- [x] 图片节点：上传/拖入/粘贴 + 自动尺寸（图片存 IndexedDB）
- [x] 导入导出兼容旧版本；导入失败给出可读 toast
- [x] Error Boundary + 全局错误提示
- [x] 500 / 1000 节点性能基准与优化（节点 memo、>80 节点仅渲染可视元素）
- [x] 单元测试：store、history、storage、迁移
- [ ] Playwright E2E：新建、连线、撤销、导入导出

**验收**：1000 节点拖拽 ≥ 45 FPS（中端机）；刷新/重启不丢数据；测试覆盖核心路径。

### v0.4 — 开源发布（1 周）

**目标**：别人能看懂、能跑、能贡献。

- [ ] README：Demo GIF、功能、架构、快速开始、路线图链接
- [ ] GitHub Pages 在线 Demo（Vite `base` 配置）
- [ ] MIT License
- [ ] CONTRIBUTING + Issue/PR 模板
- [ ] GitHub Actions：typecheck、lint、unit、build、Playwright
- [ ] CHANGELOG + `v0.1.0` / `v0.2.0` tag
- [ ] 3–5 张高质量截图/短视频
- [ ] 仓库 description/topics

**验收**：新用户 3 分钟内本地跑起来；CI 全绿；Demo 可直接访问。

### v0.5 — 可选方向（按求职目标选一个）

**A. AI 指令栏（2 周，推荐）**

- 自然语言 → 结构化动作（新增节点/连线/改颜色/整理）
- 动作确认卡片 + 撤销
- Mock 模型 + 真实 LLM 适配器
- 工具 schema + eval 用例（10 条）
- 价值：和 AI Agent 简历主线强相关

**B. 多人协作（3–4 周）**

- Yjs + WebSocket/WebRTC
- 光标/在线状态/房间
- 冲突合并与离线重连
- 价值：技术深度高，但调试成本高

**C. 插件系统（3 周）**

- 节点/命令/存储插件接口
- 示例插件：便签、图片、Markdown
- 价值：架构能力展示

### v1.0 — 稳定版（持续）

- [ ] Schema 稳定 + 迁移文档
- [ ] 插件 API 文档
- [ ] 5000 节点性能目标
- [ ] 完整键盘导航/可访问性
- [ ] i18n（中/英）
- [ ] 主题（深/浅/跟随系统）
- [ ] 文档站（VitePress/Astro）
- [ ] 社区 issue/PR 响应机制

---

## 5. 技术专项

### 5.1 性能

| 风险 | 措施 |
| --- | --- |
| 节点多时重渲染 | 已做：节点组件 `memo`（`nodePropsEqual` 忽略位置/尺寸） |
| 边/节点 DOM 过多 | 已做：>80 节点开启 `onlyRenderVisibleElements`，小地图 >60 自动收起 |
| 拖拽掉帧 | 拖拽期间关闭动画/阴影；`nodeDragThreshold` |
| 历史快照内存 | 限制 50 步；后续改增量 patch |
| localStorage 容量 | 图片走 IndexedDB，不塞 base64 |

**基准场景**：500 / 1000 / 2000 节点，记录 FPS、拖拽延迟、首屏时间。

### 5.2 历史与撤销

- 当前：结构变更/拖拽开始/首次编辑前 `commit()` 快照。
- 问题：文本编辑每次 focus 后首次输入才提交，逻辑分散。
- 计划：抽 `history` 中间件，统一 `transaction(fn)`：
  - 结构操作自动快照；
  - 连续输入合并为一次；
  - 支持命令式 undo/redo 和分组。

### 5.3 存储

- 已实现：快照存 localStorage，图片 Blob 存 IndexedDB（`idb:<id>` 引用）；旧 data URL 启动时自动迁移，导出时重新内嵌为 data URL。
- JSON schema：
  ```json
  { "version": 3, "nodes": [], "edges": [], "viewport": { "x": 0, "y": 0, "zoom": 1 } }
  ```
- 迁移：`migrate(snapshot): Snapshot`，逐版本升级，失败回退到空画布并提示。
- 导入校验：节点必须有 `id/type/position/data`，边必须有 `id/source/target`。

### 5.4 测试

| 层级 | 工具 | 覆盖 |
| --- | --- | --- |
| 单元 | Vitest | store、history、storage、快捷键、导入校验 |
| 组件 | React Testing Library | NoteNode 编辑、Toolbar 按钮状态 |
| E2E | Playwright | 新建、连线、撤销、导入导出、刷新恢复 |
| 性能 | 自定义脚本 | 500/1000 节点 FPS 与内存 |

**质量门禁**：`tsc -b`、`oxlint`、`vitest run`、`playwright test`、`vite build` 全部通过才能合并。

### 5.5 可访问性

- 所有按钮有 `aria-label` / `title`。
- 键盘：Tab 聚焦工具栏，Enter/Space 触发；节点编辑可 Esc 退出。
- 颜色对比度 ≥ 4.5:1；不只用颜色表达状态。
- 减少动画：`prefers-reduced-motion`。

### 5.6 安全

- 导入 JSON 只接受白名单字段，忽略未知字段。
- 图片 URL 只允许 `blob:` / `https:`，拒绝 `javascript:`。
- 不执行用户输入中的 HTML/脚本。
- 第三方依赖定期 `npm audit`。

---

## 6. 发布与开源运营

### 6.1 发布流程

1. `npm run build` + `lint` + `test` 全绿。
2. 更新 `CHANGELOG.md` 和 `package.json` 版本。
3. `git tag v0.x.0` + `git push --tags`。
4. GitHub Release 写变更摘要 + Demo 链接。
5. 部署 GitHub Pages（`gh-pages` 分支或 Actions）。

### 6.2 GitHub Pages

- `vite.config.ts` 增加 `base: '/infinite-canvas/'`（项目页）。
- Actions：`npm ci` → `npm run build` → 上传 `dist` → deploy。
- 自定义域名时改 `base: '/'`。

### 6.3 社区

- Issue 模板：Bug / Feature / Question。
- PR 模板：改了什么、怎么验证、截图。
- 每两周整理一次 roadmap 和 good first issue。
- 不追求 star，先保证 3 个真实用户能用。

---

## 7. 指标

| 指标 | v0.1 现状 | v0.4 目标 |
| --- | --- | --- |
| 首屏 JS gzip | 146 KB | ≤ 150 KB |
| 1000 节点拖拽 FPS | 60（headless 基准） | ≥ 45 |
| 核心 E2E 用例 | 0 | ≥ 8 |
| 单元测试 | 83 | ≥ 25 |
| CI 时长 | 无 | ≤ 3 min |
| 新用户跑起来 | 需手动 | ≤ 3 min |
| Lighthouse Performance | 未测 | ≥ 90 |

---

## 8. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 范围膨胀（协作/AI/插件一起做） | 永远发不出 v1.0 | 每阶段只选一个方向，其余进 backlog |
| React Flow 大图性能瓶颈 | 1000+ 节点卡顿 | 先做基准，必要时虚拟化/分层渲染 |
| 撤销语义复杂 | 用户不敢用 | 统一 transaction，补 E2E |
| localStorage 容量/迁移 | 数据丢失 | v0.3 上 IndexedDB + schema 迁移 |
| GitHub Pages base 配错 | Demo 404 | CI 里跑一次 Pages 构建产物检查 |
| 第三方 License | 开源合规 | MIT + 保留 React Flow attribution |
| 没有用户 | 自嗨 | 先给 3 个朋友试用，收集 5 条反馈 |

---

## 9. 排期建议

**兼职（每周 8–10 小时）**

| 周 | 内容 |
| --- | --- |
| 第 1 周 | 测试 + CI + Pages + README 门面 |
| 第 2 周 | 节点类型 + 右键菜单 + 选中工具栏 |
| 第 3 周 | 对齐/吸附 + 自动布局 + 边样式 |
| 第 4 周 | schema/迁移 + IndexedDB + 错误边界 |
| 第 5 周 | 性能基准 + 优化 + E2E |
| 第 6 周 | 发布 v0.2.0，收集反馈 |
| 第 7–8 周 | 选一个方向：AI 指令栏 / 协作 / 插件 |

**全职**：约 2–3 周到 v0.4 可发布状态。

---

## 10. 下一个 Sprint（10 个任务）

按优先级排序，可直接开 issue：

1. [x] 加 Vitest + store/history/storage 单测（4h）
2. [x] 加 GitHub Actions：typecheck/lint/test/build（2h）
3. [x] 配 GitHub Pages 部署（2h）
4. [ ] README 加 Demo GIF/截图（3h）
5. [x] 右键菜单 + 选中工具栏（4h）
6. [x] 对齐辅助线 + 网格吸附（6h）
7. [x] Dagre 自动布局（4h）
8. [x] Text/Image/Group 节点（8h）
9. [x] schema 版本 + 迁移（3h）
10. [ ] 500/1000 节点性能基准（4h）

---

## 11. 待决策

- [ ] License：MIT（推荐）/ Apache-2.0
- [ ] 部署：GitHub Pages（推荐）/ Cloudflare Pages / Vercel
- [ ] 包管理：npm（当前）/ pnpm
- [ ] 是否保留 `private: true`（只影响 npm 发布）
- [ ] v0.5 方向：AI 指令栏（推荐，和简历主线一致）/ 协作 / 插件

---

## 12. 完成定义（Definition of Done）

一个功能算完成，必须同时满足：

- 代码通过 `tsc -b`、`oxlint`、单元测试、E2E。
- 有明确交互反馈（hover/disabled/loading/error）。
- 刷新后数据/状态符合预期。
- 不引入未使用依赖。
- README/CHANGELOG 有对应说明（发布阶段）。
- 有截图或录屏可验证。
