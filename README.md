# Infinite Canvas

A local-first infinite canvas built with React 19, TypeScript, [@xyflow/react](https://reactflow.dev), and Zustand.

> Demo: <https://ricardo0510.github.io/infinite-canvas/> (published automatically from `main`)

See [ROADMAP.md](./ROADMAP.md) for the development plan.

## Features

- Infinite pan/zoom, minimap, controls, fit view
- Node types: **Text**, **Image**, **Video**, **Group** (sub-flows)
- Drag a node into a group to join it, drag it out to leave; groups expand to fit
- Inline editing, accent colors, free resize with persisted sizes
- Drag, connect, multi-select, box select, snap to grid (8 px)
- Duplicate/self connections blocked; hover an edge to delete it
- Drag a connection into blank canvas to create and connect a node (upstream or downstream)
- Edge toolbar: label, color, solid/dashed/dotted line, arrow toggle
- Command palette (`/`) for nodes, templates, layout, export and view actions
- Starter templates: flowchart, mind map, kanban, meeting notes
- Drop image files anywhere or paste from the clipboard; images are fitted to a readable node size
- Right-click `Upload file` creates static image or video nodes from local files
- Selecting an image or video node with content shows a toolbar with fullscreen preview
- Global error boundary and toast notifications for import/upload failures
- Smart snapping to other nodes' edges/centers, dashed alignment guides while dragging
- Align / distribute / group from the selection toolbar
- Viewport persistence, zoom presets and minimap toggle in the bottom-left controls
- AI generation: text, image and video nodes with model selection, prompts, references from upstream nodes, task recovery and local Mock mode
- Right-click context menu: add nodes, duplicate, layer order, group, delete
- One-click auto layout (Dagre, loaded on demand)
- Undo/redo, copy/paste, duplicate
- Snapshot autosave to `localStorage`; image blobs in IndexedDB
- Versioned JSON import/export with schema migration
- Shortcut cheatsheet (`?`), empty-canvas onboarding

## AI generation

AI features run in Mock mode by default, so the canvas works without a backend. To use the real API, copy `.env.example` to `.env.local` and set:

```bash
VITE_AI_API_BASE_URL=https://your-api.example.com/v1
VITE_AI_REALTIME_BASE_URL=wss://your-api.example.com
VITE_AI_MOCK=0
```

Open the `AI` button in the toolbar to set a session token. Click a Text, Image, or Video node to open its prompt editor next to the node; generated content stays on the node itself. Text, image, and video generation all run as async tasks and require the realtime WebSocket channel; there is no HTTP polling fallback. API contract: [docs/backend-api-plan.md](./docs/backend-api-plan.md); frontend design: [docs/ai-generation-development-plan.md](./docs/ai-generation-development-plan.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b + vite build
npm run preview
```

## Backend

```bash
docker-compose -f server/docker-compose.yml up -d postgres redis
cd server
cp .env.example .env
npm install
npm run prisma:migrate
npm run dev        # http://localhost:8790/v1
```

前端在 AI 设置中填写 `http://localhost:8790/v1` 和 `ws://localhost:8790`。任务与幂等键持久化到 PostgreSQL，Redis + BullMQ 负责任务队列。文本模型支持 DeepSeek 4.1 Flash（配置 `DEEPSEEK_API_KEY` 后自动出现在模型列表），图片/视频仍由 Mock Provider 产生。完整契约见 [docs/backend-api-plan.md](./docs/backend-api-plan.md)，后台管理方案见 [docs/admin-system-development-plan.md](./docs/admin-system-development-plan.md)。

## Quality

```bash
npm run typecheck  # tsc -b
npm run lint       # oxlint
npm test           # vitest run
```

CI runs typecheck, lint, unit tests, and a production build on every push and pull request.

## Performance

```bash
npm run bench -- 500
npm run bench -- 1000
```

The benchmark builds the app, starts a preview server and drives a throwaway headless Chrome (`CHROME_PATH` overrides auto-detection). It reports setup time, idle FPS, drag FPS, long tasks and JS heap. Above 80 nodes only nodes inside the viewport are mounted.

| Nodes | Rendered DOM | Setup | Idle | Drag | Long tasks |
| --- | --- | --- | --- | --- | --- |
| 500 | 15 | 323 ms | 60.3 fps | 60.1 fps | 0 |
| 1000 | 15 | 326 ms | 60.0 fps | 59.7 fps | 0 |

Headless Chrome, 1440×900, production build.

## Shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl/Cmd + Z` / `Shift + Z` | Undo / redo |
| `Ctrl/Cmd + C` / `V` | Copy / paste selected nodes |
| `Ctrl/Cmd + D` | Duplicate selected nodes |
| `Ctrl/Cmd + A` | Select all / clear selection |
| `Ctrl/Cmd + G` / `Shift + G` | Group / ungroup |
| `Ctrl/Cmd + L` | Auto layout |
| `Ctrl/Cmd + E` | Export JSON |
| `Ctrl/Cmd + 0` | Fit view |
| `Arrow keys` | Nudge 1px (`Shift`: 10px) |
| `F` | Focus selection |
| `Ctrl/Cmd + S` | Save to `localStorage` |
| `Delete` / `Backspace` | Delete selected nodes |
| `/` | Command palette |
| `?` | Keyboard shortcuts |

Double-click the canvas to add a text node, right-click for the context menu, and drag the left/right handles to connect nodes.

## Structure

```
src/
  components/
    FlowCanvas.tsx        # React Flow container, menus, guides, overlays
    Toolbar.tsx           # add nodes, undo, layout, snap, import/export
    CanvasControls.tsx    # zoom presets, fit view, minimap toggle
    CommandPalette.tsx    # `/` command palette
    SelectionToolbar.tsx  # align / distribute / group
    EdgeToolbar.tsx       # edge label / color / dash / arrow
    ErrorBoundary.tsx     # render-crash fallback
    ToastHost.tsx         # transient notifications
    StatusBar.tsx
    ContextMenu.tsx       # right-click actions
    KeyboardHelp.tsx      # shortcut cheatsheet
    EmptyState.tsx        # onboarding for an empty canvas
    ai/                   # AI panel, model select, settings
    nodes/                # Text, Image, Video, Group
    edges/                # Smoothstep edge with hover delete
  hooks/
    useAutoSave.ts        # debounced localStorage writes
    useCanvasShortcuts.ts
    useResolvedImageSrc.ts # IndexedDB ref → object URL
  lib/
    ai/                   # API client, providers, task manager, mock
    storage.ts            # schema v5, validation, migration, import/export
    geometry.ts           # sizes, absolute rects, descendants
    guides.ts             # smart snapping + alignment guide math
    templates.ts          # starter canvases
    images.ts             # image validation, decode and fit sizing
    imageStore.ts         # IndexedDB blob store + data URL fallback
    imageMigration.ts     # inline data URL → IndexedDB migration/pruning
    stress.ts             # deterministic canvas used by the benchmark
    layout.ts             # Dagre (dynamic import)
  store/
    canvasStore.ts        # nodes/edges/history/clipboard
    uiStore.ts            # snap toggle, help panel, AI panel
```

Data model: `{ version: 5, nodes, edges, viewport? }`. Older `v1` through `v4` snapshots are migrated on load; unknown fields and unsafe image URLs are dropped. Image sources are `idb:<id>` refs (blob stored in IndexedDB), `https:`, or legacy `data:image/` URLs. Video nodes store `https:` sources and optional posters.

## Notes

- Everything stays in the browser. Snapshots live in `localStorage`; image blobs live in IndexedDB and are embedded back as data URLs when exporting JSON. Clearing site data still deletes both stores.
- `BASE_PATH` controls the Vite `base`; the Pages workflow builds with `/infinite-canvas/`.
