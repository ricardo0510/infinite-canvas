# Infinite Canvas 节点样式与交互逻辑

> 当前实现：schema v5  
> 代码：`src/components/nodes/*`、`src/components/ai/*`、`src/components/edges/*`、`src/store/canvasStore.ts`、`src/components/FlowCanvas.tsx`、`src/styles/*.scss`

---

## 1. 总览

| 节点 | type | 宽度 | 高度 | 强调色 | 用途 |
| --- | --- | --- | --- | --- | --- |
| Text | `text` | 固定 280 | 默认 160 | 默认 emerald | 文本展示、文本生成 |
| Image | `image` | 固定 280 | 空态 160；有图按比例 | cyan | 图片展示、图片生成、静态上传 |
| Video | `video` | 固定 280 | 空态 160；有视频按比例 | amber | 视频播放、视频生成、静态上传 |
| Group | `group` | 默认 320 | 默认 200 | 默认 amber | 分组容器、嵌套 |

已移除 Note 节点。旧快照中的 `note` 节点加载时会自动转换成 Text 节点：`title` 保留，`body` 转为 `text`。

---

## 2. 公共节点框架

```text
┌──────────────────────────────┐
│ ●  Title              ● ● ● ●│  34px header
├──────────────────────────────┤
│                              │
│         内容 / 空态           │  自适应
│                              │
└──────────────────────────────┘
```

### 2.1 外层样式

- 固定宽度 280px。
- 圆角 12px，深色渐变背景。
- 默认边框 `var(--border-strong)`。
- 选中：边框 + 1px 外发光使用节点强调色。
- 生成中：边框呼吸光 + 全节点加载遮罩。
- 左侧 target、右侧 source 连接端口。
- 没有底部 footer。
- 没有手动缩放手柄。

### 2.2 拖拽与 Header

- **整个节点都可以拖拽**。
- 按钮、颜色圆点、标题输入框、textarea、视频控件等交互元素保持 `nodrag`。
- Header 高度 34px。
- Header 右侧操作区：
  - Text：4 个颜色圆点。
  - Group：4 个颜色圆点。
  - Image：无。
  - Video：无。
- 连接点视觉直径 10px，外围额外 7px 透明点击区，`z-index` 高于节点内容。

### 2.3 标题编辑

- 默认标题：
  - Text：`Text`
  - Image：`Image`
  - Video：`Video`
- 标题单行省略。
- 单击标题：选中节点并打开 AI 浮窗。
- **双击标题**才进入编辑模式。
- 编辑模式：
  - 自动聚焦并全选。
  - `Enter` 保存。
  - `Esc` 取消。
  - 失焦保存。
  - 空标题回退默认值。
  - 输入框为 `nodrag`。

### 2.4 内容区与空态

- 内容区带 `nowheel`，可拖拽节点。
- textarea / 视频控件等交互元素单独 `nodrag`。
- 空态统一：
  - 相同高度、背景、颜色、布局。
  - 圆形 `+` 图标 + “点击生成”。
  - 点击空态会选中节点并打开 AI 浮窗。

### 2.5 状态

- `idle`：正常显示。
- `queued` / `running`：
  - 节点边框呼吸光。
  - 全节点加载遮罩。
  - 旋转指示器 + 状态文案 + 进度条。
- `failed`：
  - 保留旧内容。
  - 内容区底部显示错误条。
- `succeeded`：正常显示结果。
- `stale`：字段保留，暂无独立 UI。

### 2.6 选中工具栏与全屏

- 单选 Image / Video 且节点有内容时，节点上方显示工具栏。
- 工具栏目前只有全屏按钮 `⛶`。
- 点击全屏按钮打开全屏预览：
  - `100vw × 100vh` 黑底，无边框、无圆角、无外边距。
  - 图片按视口等比完整显示。
  - 视频显示 `controls + autoPlay` 播放器。
  - 标题和关闭按钮以顶部浮层显示。
  - 点击背景、关闭按钮或按 `Esc` 关闭。
- 静态上传节点同样支持全屏预览。
- Text / Group、空内容节点不显示该工具栏。
- AI 浮窗在工具栏上方时会自动加大偏移，避免重叠。

---

## 3. Text 节点

文件：`src/components/nodes/TextNode.tsx`

```ts
type TextData = {
  title: string;
  text: string;
  color: NoteColor;
  fontSize: number;
  generation?: GenerationMeta;
};
```

### 样式

- 宽度 280，默认高度 160。
- Header 右侧 4 个颜色圆点。
- 内容区：
  - 有文本：可编辑 textarea。
  - 无文本：统一空态。

### 交互

- 单击节点：选中、置顶、打开 AI 浮窗。
- 双击标题：编辑标题。
- 整个节点可拖拽；textarea 为 `nodrag`。
- 内容 textarea：
  - 可直接编辑。
  - 第一次输入记录一次历史快照。
- 颜色圆点：
  - 切换标题圆点、边框、光照强调色。
  - 点击不会触发节点拖拽或打开浮窗。
- 文本生成：
  - 提示词在浮窗中输入。
  - 生成期间保留旧文本。
  - 成功后整体替换 `text`。
  - 失败/取消保留旧文本。
- 上游文本自动拼接到提示词后方。
- 字号仍保存在 `fontSize`，当前没有 UI 调整入口。

---

## 4. Image 节点

文件：`src/components/nodes/ImageNode.tsx`

```ts
type ImageData = {
  title: string;
  static?: boolean;
  src: string;
  alt: string;
  generation?: GenerationMeta;
};
```

### 尺寸

- 宽度固定 280。
- 空态高度 160。
- 有图片时：

```text
height = 34（header） + 280 × 图片高 / 图片宽
```

- 图片加载后通过 `onLoad` 读取自然宽高并更新节点高度。
- `object-fit: contain`，不裁切。
- 切换图片后重新计算高度。

### 空态

- 与 Text / Video 相同：圆形 `+` + “点击生成”。
- 点击空态打开 AI 浮窗。

### 交互

- 有图：显示图片。
- 节点本身没有上传按钮，也不接受节点内拖拽上传。
- 本地上传通过画布右键菜单 `Upload file`：
  - 选择图片后自动创建 Image 节点。
  - 创建的节点为静态节点（`static: true`）。
  - 校验类型与 4MB 上限。
  - 解码宽高。
  - Blob 存入 IndexedDB，节点保存 `idb:<id>`。
  - 标题更新为文件名。
  - 按图片比例更新高度。
- 全画布拖入/粘贴图片仍会创建静态 Image 节点。
- 支持 `https:` / `blob:` / `data:image/` / `idb:`。
- 生成结果：
  - 默认使用第一张结果更新 `src`。
  - 多图结果保存在 `generation.results`，可在“生成设置”弹窗中切换。
  - 有上游图片时自动进入图生图。
- 生成中保留旧图，成功替换；失败保留旧图并显示错误。

---

## 5. Video 节点

文件：`src/components/nodes/VideoNode.tsx`

```ts
type VideoData = {
  title: string;
  static?: boolean;
  src: string;
  thumbnailUrl: string;
  alt: string;
  generation?: GenerationMeta;
};
```

### 尺寸

- 宽度固定 280。
- 空态高度 160。
- 有视频时：

```text
height = 34 + 280 × 视频高 / 视频宽
```

- `onLoadedMetadata` 读取真实宽高后更新节点高度。
- 如果视频元数据加载失败，使用封面图片比例兜底。
- `object-fit: contain`。

### 交互

- 有视频：原生 `<video controls>` 播放。
- 无底部工具栏。
- 生成节点点击打开 AI 浮窗；本地静态上传节点点击只选中，不打开浮窗。
- 本地上传通过画布右键菜单 `Upload file`：
  - 选择视频后自动创建 Video 节点。
  - 节点为静态节点。
  - 视频 Blob 存入 IndexedDB。
- 生成模式自动识别：
  - 有上游视频 → 参考视频。
  - 有上游图片 → 图生视频。
  - 无图片/视频 → 文生视频。
- 结果：
  - 更新 `src` 与 `thumbnailUrl`。
  - 结果历史在“生成设置”弹窗中切换。
- 生成中保留旧视频，完成后替换。
- 失败保留旧视频并显示错误。

---

## 6. Group 节点

文件：`src/components/nodes/GroupNode.tsx`

```ts
type GroupData = {
  label: string;
  color: NoteColor;
};
```

### 样式

- 默认 320 × 200，最小 220 × 140。
- React Flow 默认 group 外观已清空。
- 1.5px 虚线容器，强调色 62% 透明度。
- 背景强调色 7% 透明度，圆角 14px。
- 选中：虚线变实线，背景 11%。
- 默认 zIndex -1。
- Header：
  - 颜色圆点。
  - 标签输入框。
  - 右侧颜色选择器。
- 分组主体区域可拖拽；标签输入框和颜色按钮保持 `nodrag`。

### 交互

- 标签可直接编辑。
- 拖拽普通节点进入分组矩形 → 成为子节点。
- 拖出分组矩形 → 离开分组。
- 嵌套分组取面积最小的包含分组。
- 分组自动扩展容纳新子节点。
- 拖动分组会带动所有子节点。
- 分组不能拖入自身或后代。
- 2 个以上节点可成组，四周留 32px padding。
- 解组后子节点保留绝对位置。
- 删除分组会删除后代节点。
- 分组没有连接端口，不能打开 AI 浮窗。
- 分组仍保留缩放能力。

---

## 7. 单击节点与 AI 浮窗

### 打开

- 单击 Text / Image / Video 生成节点：
  - 选中并置顶。
  - 打开 AI 提示词浮窗。
- 单击本地静态节点（`data.static === true`）：
  - 只选中并置顶。
  - 不打开 AI 浮窗。
- 单击 Group：
  - 选中/拖拽。
  - 关闭 AI 浮窗。
- 单击空白：
  - 清除选择。
  - 关闭 AI 浮窗。
- 节点默认就是 AI 生成模式，不再需要 footer 里的 AI 按钮。

### 位置

- 使用 `NodeToolbar` 跟随节点。
- 默认在节点下方。
- 下方空间不足时自动放到上方，并避让选中工具栏。
- 宽度 560px，最大高度约 70vh，可滚动。

### 内容

- 浮窗内只有一个提示词输入框，打开时自动聚焦。
- 输入框底部：
  - 左侧：模型选择。
  - 中间：`配置` 按钮。
  - 右侧：`生成` / `取消等待` 按钮。
- 生成中不展示其它配置项。
- 错误信息以一条错误提示显示在底部。
- 结果历史、比例、分辨率、数量/时长、画质、背景、负向提示词、音频、自定义参数均移入“生成设置”弹窗。
- 点击 `配置` 打开生成设置弹窗，弹窗内可切换结果历史。

### 模式自动识别

- 不再提供模式选择。
- Image：
  - 有上游图片 → `imageToImage`。
  - 无上游图片 → `textToImage`。
- Video：
  - 有上游视频 → `referenceVideo`。
  - 有上游图片 → `imageToVideo`。
  - 无图片/视频 → `textToVideo`。
- 每次生成前重新根据当前引用推导模式。

### 生成流程

- `生成` 或 `Ctrl/Cmd + Enter`。
- 收集上游文本/图片/视频。
- 本地图片先上传为远程 URL。
- 文本：同步请求，完成后整体替换。
- 图片/视频：任务 + WebSocket + 轮询兜底。
- 成功写入节点并标记下游 stale。
- 失败保留旧内容并显示错误。

---

## 8. 连线与画布交互

- 左侧 target，右侧 source。
- 连接点视觉直径 10px，外围额外 7px 透明点击区，且 z-index 高于节点内容。
- 禁止自连和重复连线。
- 默认边：贝塞尔曲线（curvature 0.35）、闭合箭头、1.5px、`#5b6478`。
- 悬停边显示删除按钮，按钮位置跟随鼠标在连接线上的最近点。
- 点击边打开 EdgeToolbar：
  - 标签。
  - 颜色。
  - 实线/虚线/点线。
  - 箭头开关。
- 从端口拖到空白打开添加节点菜单，并自动连线。
- 8px 网格吸附。
- 拖拽时显示智能对齐辅助线。
- 左键拖空白框选；Shift/Ctrl/Cmd 追加选择。
- 中键/右键拖拽平移。
- 双击空白新增 Text 节点。
- 拖入/粘贴图片批量新增静态 Image 节点。

---

## 9. 工具栏、右键与选择工具条

### 顶部工具栏

- Add：Text、Image、Video、Group。
- Undo / Redo。
- Layout：Dagre 自动布局。
- Snap：网格吸附。
- Fit：适应视图。
- Export / Import JSON。
- Commands。
- AI 设置。
- Shortcuts。
- Clear。

### 右键菜单

- 节点/选区：Duplicate、Bring to front、Send to back、Group、Ungroup、Delete。
- Add：Text、Image、Video、Group。
- Upload file：按文件类型创建静态 Image / Video 节点。
- Paste、Fit view。

### 选择工具条

- 选中数量。
- 2 个及以上：6 种对齐。
- 3 个及以上：水平/垂直分布。
- 成组 / 解组。
- 删除。

---

## 10. 快捷键

| 快捷键 | 行为 |
| --- | --- |
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | 重做 |
| `Ctrl/Cmd + C` / `V` | 复制 / 粘贴 |
| `Ctrl/Cmd + D` | 复制副本 |
| `Ctrl/Cmd + A` | 全选 / 取消全选 |
| `Ctrl/Cmd + G` / `Shift + G` | 成组 / 解组 |
| `Ctrl/Cmd + L` | 自动布局 |
| `Ctrl/Cmd + E` | 导出 JSON |
| `Ctrl/Cmd + S` | 保存到 localStorage |
| `Ctrl/Cmd + 0` | 适应视图 |
| `Delete` / `Backspace` | 删除 |
| 方向键 | 移动 1px；`Shift` 移动 10px |
| `F` | 聚焦选中节点 |
| `/` | 命令面板 |
| `?` | 快捷键面板 |
| `Esc` | 清除选择 / 关闭预览 |
| 浮窗内 `Ctrl/Cmd + Enter` | 触发生成 |

---

## 11. 持久化

- schema v5。
- 存储键：`infinite-canvas:v5`。
- 旧 v1–v4 自动迁移。
- 旧 Note 节点自动转 Text。
- 自动保存 400ms 防抖。
- 图片：本地 IndexedDB `idb:` 引用或远程 URL；导出时本地 Blob 转 data URL。
- 视频：本地 IndexedDB `idb:` 引用或远程 URL；导出时本地 Blob 转 data URL。
- 节点尺寸、标题、`static` 标记、生成元数据、结果历史随快照保存。

---

## 12. 当前注意点

1. Text / Image / Video 宽度固定 280，不支持手动缩放。
2. Image / Video 高度依赖资源加载完成；加载前使用 160 默认高度。
3. 整个节点都可以拖拽；按钮、输入框、textarea、视频控制条等交互控件保持 `nodrag`。
4. 标题只有双击才进入编辑。
5. Text 正文仍可直接编辑；暂无字号调整 UI。
6. 文本生成是同步请求，无流式输出，不能刷新恢复。
7. 视频节点本身没有上传入口；本地上传统一走画布右键 `Upload file`。
8. 本地静态节点点击只选中，不打开 AI 浮窗。
9. 模型自定义参数 `extra` 在“生成设置”弹窗中以 select 渲染。
10. 连接线默认贝塞尔曲线；水平对齐的节点仍会呈直线。
