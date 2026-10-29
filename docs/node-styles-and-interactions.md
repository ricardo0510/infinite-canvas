# Infinite Canvas 节点样式与交互逻辑

> 当前实现：schema v5  
> 代码：`src/components/nodes/*`、`src/components/ai/*`、`src/store/canvasStore.ts`、`src/components/FlowCanvas.tsx`、`src/index.css`

---

## 1. 总览

| 节点 | type | 宽度 | 高度 | 强调色 | 用途 |
| --- | --- | --- | --- | --- | --- |
| Text | `text` | 固定 280 | 默认 160 | 默认 emerald | 文本展示、文本生成 |
| Image | `image` | 固定 280 | 空态 160；有图按比例 | cyan | 图片上传/外链、图片生成 |
| Video | `video` | 固定 280 | 空态 160；有视频按比例 | amber | 视频播放、视频生成 |
| Group | `group` | 默认 320 | 默认 200 | 默认 amber | 分组容器、嵌套 |

已移除 Note 节点。旧快照里的 `note` 节点在加载时会自动转换成 Text 节点：`title` 保留，`body` 转为 `text`。

---

## 2. 公共节点框架

Text / Image / Video 三类节点使用同一个框架：

```text
┌──────────────────────────────┐
│ ●  Title                     │  34px，拖拽区
├──────────────────────────────┤
│                              │
│           内容 / 空态          │  自适应
│                              │
├──────────────────────────────┤
│ 类型工具 / AI 按钮            │  34px
└──────────────────────────────┘
```

### 2.1 外层样式

- 固定宽度 280px。
- 圆角 12px，深色渐变背景。
- 默认边框 `var(--border-strong)`。
- 选中：边框和 1px 外发光使用节点强调色。
- 生成中：边框脉冲动画 + 全节点加载遮罩。
- 左右连接端口：
  - 左侧 target。
  - 右侧 source。
- 不再提供四角缩放手柄；宽度统一，高度由内容决定。

### 2.2 标题栏

- 高度 34px，是节点的拖拽区域。
- 左侧圆点使用节点强调色。
- 标题默认值：
  - Text：`Text`
  - Image：`Image`
  - Video：`Video`
- 标题显示为单行省略。
- **双击标题才进入编辑模式**。
- 编辑模式：
  - 输入框自动聚焦并全选。
  - `Enter` 保存。
  - `Esc` 取消。
  - 失焦保存。
  - 空标题回退到默认标题。
  - 编辑输入框为 `nodrag`，不会拖动节点。
- 单击标题不进入编辑；单击事件冒泡给节点，用于选中并打开输入浮窗。

### 2.3 内容区

- 使用 `.node-body`，带 `nodrag nowheel`。
- 内容区不能拖拽节点，只有标题栏可以拖拽。
- 空态统一：
  - 相同高度、背景、颜色、布局。
  - 圆形 `+` 图标 + “点击生成”。
  - 点击空态区域会冒泡到节点，选中并打开输入浮窗。

### 2.4 底部工具区

- 高度 34px，固定在节点底部。
- Text：字号减 / 字号加 / AI / 颜色。
- Image：图片 URL 或文件名 / Upload / AI。
- Video：标题或名称 / AI。

### 2.5 状态

- `idle`：正常显示。
- `queued` / `running`：
  - 节点边框呼吸光。
  - 内容上方显示加载遮罩。
  - 遮罩包含旋转指示器、状态文案、进度条。
- `failed`：
  - 保留旧内容。
  - 内容区底部显示错误条。
- `succeeded`：正常显示结果。
- `stale`：目前保留字段，UI 尚未显示独立提示条。

---

## 3. Text 节点

文件：`src/components/nodes/TextNode.tsx`  
数据：

```ts
type TextData = {
  title: string;
  text: string;
  color: NoteColor;
  fontSize: number;
  generation?: GenerationMeta;
};
```

### 3.1 样式

- 固定宽度 280，默认高度 160。
- 强调色来自 `color`，默认 emerald。
- 标题栏 + 内容区 + 底部工具。
- 内容区：
  - 有文本：显示可编辑 textarea。
  - 无文本：统一空态“点击生成”。

### 3.2 交互

- 单击节点：
  - 选中并置顶。
  - 打开 AI 提示词浮窗。
- 双击标题：编辑标题。
- 拖拽标题栏：移动节点。
- 内容 textarea：
  - 可直接编辑文本。
  - 第一次输入时记录一次历史快照。
- `A−` / `A+`：
  - 字号减/加 2。
  - 范围 10–64px。
- 颜色圆点：切换强调色。
- `AI`：打开提示词浮窗。
- 文本生成：
  - 提示词在浮窗中输入。
  - 生成期间保留旧文本。
  - 成功后整体替换 `text`。
  - 失败/取消保留旧文本。
- 上游文本会自动拼接到提示词后方。

---

## 4. Image 节点

文件：`src/components/nodes/ImageNode.tsx`  
数据：

```ts
type ImageData = {
  title: string;
  src: string;
  alt: string;
  generation?: GenerationMeta;
};
```

### 4.1 尺寸规则

- 宽度固定 280。
- 空态高度 160。
- 有图片时：

```text
height = 34（标题栏） + 280 × 图片高 / 图片宽 + 34（底部栏）
```

- 图片加载完成后通过 `onLoad` 读取自然宽高并更新节点高度。
- 图片使用 `object-fit: contain`，不裁切。
- 切换图片会重新按新图比例计算高度。

### 4.2 空态

- 与 Text / Video 完全相同的空态样式：
  - 圆形 `+`
  - “点击生成”
- 点击空态区域会打开 AI 浮窗。

### 4.3 内容与工具

- 有图：显示图片。
- 底部：
  - 上传图片时显示文件名。
  - 外链图片显示 URL 输入框。
  - `Upload` 按钮。
  - `AI` 按钮。
- 支持：
  - 点击 `Upload`。
  - 拖拽图片文件到节点。
  - 全画布拖入/粘贴图片。
- 上传流程：
  - 校验类型与 4MB 上限。
  - 解码宽高。
  - Blob 存入 IndexedDB，节点保存 `idb:<id>`。
  - 标题更新为文件名。
  - 按图片比例更新高度。
- 支持 `https:` / `blob:` / `data:image/` / `idb:`。
- 生成结果：
  - 默认使用第一张结果更新 `src`。
  - 多图结果保留在 `generation.results`，可在浮窗结果条切换。
  - 有上游图片时自动进入图生图。
- 生成中保留旧图，成功替换；失败保留旧图并显示错误。

---

## 5. Video 节点

文件：`src/components/nodes/VideoNode.tsx`  
数据：

```ts
type VideoData = {
  title: string;
  src: string;
  thumbnailUrl: string;
  alt: string;
  generation?: GenerationMeta;
};
```

### 5.1 尺寸规则

- 宽度固定 280。
- 空态高度 160。
- 有视频时：

```text
height = 34 + 280 × 视频高 / 视频宽 + 34
```

- 视频 `onLoadedMetadata` 读取真实宽高后更新节点高度。
- 视频使用 `object-fit: contain`。
- 封面使用 `thumbnailUrl`，通过 `useResolvedImageSrc` 兼容本地引用。

### 5.2 空态

- 与 Text / Image 相同：
  - 圆形 `+`
  - “点击生成”
- 点击空态打开 AI 浮窗。

### 5.3 交互

- 有视频：原生 `<video controls>` 播放。
- 底部：名称 + `AI` 按钮。
- 无本地上传入口。
- 生成模式：
  - 文生视频。
  - 图生视频。
  - 首尾帧。
  - 参考视频。
- 结果：
  - 更新 `src` 与 `thumbnailUrl`。
  - 结果历史在浮窗中切换。
- 生成中保留旧视频，完成后替换。
- 失败保留旧视频并显示错误。

---

## 6. Group 节点

文件：`src/components/nodes/GroupNode.tsx`  
数据：

```ts
type GroupData = {
  label: string;
  color: NoteColor;
};
```

### 6.1 样式

- 默认 320 × 200，最小 220 × 140。
- React Flow 默认 group 外观已清空。
- 1.5px 虚线容器，颜色为强调色 62% 透明度。
- 背景为强调色 7% 透明度，圆角 14px。
- 选中：虚线变实线，背景透明度提高到 11%。
- 默认 zIndex 为 -1，位于普通节点下方。
- 头部：颜色圆点 + 标签输入框 + 颜色圆点组。

### 6.2 交互

- 标签可直接编辑。
- 拖拽普通节点进入分组矩形 → 成为子节点。
- 拖出分组矩形 → 离开分组。
- 嵌套分组取面积最小的包含分组。
- 分组自动扩展容纳新子节点，保留子节点绝对位置。
- 拖动分组会带动所有子节点。
- 分组不能拖入自身或后代。
- 选中 2 个以上节点可成组，四周留 32px padding。
- 解组后子节点保留绝对位置。
- 删除分组会删除后代节点。
- 分组没有连接端口，不能打开 AI 浮窗。
- 分组保留缩放能力。

---

## 7. 单击节点与 AI 浮窗

### 7.1 打开

- 单击 Text / Image / Video 节点：
  - 选中节点。
  - 置顶。
  - 打开该节点的 AI 输入浮窗。
- 单击 Group：
  - 选中/拖拽。
  - 关闭 AI 浮窗。
- 单击空白：
  - 清除选择。
  - 关闭 AI 浮窗。
- 从节点上的 `AI` 按钮打开，同样有效。
- 生成中的节点也可以单击打开浮窗，用于查看状态或取消。

### 7.2 位置

- 使用 React Flow `NodeToolbar` 跟随节点。
- 默认在节点下方。
- 下方空间不足且上方更充足时自动放到上方。
- 浮窗宽度 560px，最大高度约 70vh，内容可滚动。

### 7.3 内容

- 提示词 textarea，自动聚焦。
- 模型选择。
- 模式选择（模型支持多模式时）。
- 图片参数：比例、分辨率、数量。
- 视频参数：比例、分辨率、时长。
- 画质档、背景、负向提示词、生成音频。
- 生成 / 取消等待。
- 状态文案与进度。
- 错误信息。
- 结果历史：文本摘要、图片缩略图、视频封面。
- 点击结果条切换 active 结果，节点内容同步切换。

### 7.4 生成流程

- 点击生成或 `Ctrl/Cmd + Enter`。
- 收集上游文本/图片/视频。
- 本地图片先上传为远程 URL。
- 文本：同步请求，完成后整体替换。
- 图片/视频：提交任务，WebSocket 与轮询同时兜底。
- 成功写入节点并标记下游 stale。
- 失败保留旧内容并显示错误。
- 文本取消只中断本地等待；图片/视频会调用取消任务接口。

---

## 8. 连线与画布交互

- 左侧 target，右侧 source。
- 禁止自连和重复连线。
- 默认边：smoothstep、闭合箭头、1.5px、`#5b6478`。
- 悬停边显示删除按钮。
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
- 拖入/粘贴图片批量新增 Image 节点。

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
| `Esc` | 清除选择 |
| 浮窗内 `Ctrl/Cmd + Enter` | 触发生成 |

---

## 11. 持久化

- schema v5。
- 存储键：`infinite-canvas:v5`。
- 旧 v1–v4 自动迁移。
- 旧 Note 节点自动转 Text。
- 自动保存 400ms 防抖。
- 图片：IndexedDB `idb:` 引用；导出时转 data URL。
- 视频：远程 URL + 封面 URL。
- 节点尺寸、标题、生成元数据、结果历史随快照保存。

---

## 12. 当前注意点

1. 三类 AI 节点宽度固定 280，不再支持手动缩放。
2. Image / Video 高度依赖资源加载完成；加载前使用 160 的默认高度。
3. 标题只有双击才进入编辑，单击标题会选中并打开 AI 浮窗。
4. 只有标题栏可以拖拽，内容区使用 `nodrag`。
5. Text 节点内容仍可直接编辑；尚未做“双击才可编辑正文”的静态文本模式。
6. 文本生成是同步请求，无流式输出，也不能刷新恢复。
7. 视频没有本地上传入口。
8. 模型自定义参数 `extra` 尚未渲染 UI。
9. 生成图片不自动镜像到 IndexedDB。
