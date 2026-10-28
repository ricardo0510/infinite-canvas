# Infinite Canvas

A local-first infinite canvas built with React 19, TypeScript, [@xyflow/react](https://reactflow.dev), and Zustand.

> Demo: <https://ricardo0510.github.io/infinite-canvas/> (published automatically from `main`)

See [ROADMAP.md](./ROADMAP.md) for the development plan.

## Features

- Infinite pan/zoom, minimap, controls, fit view
- Node types: **Note**, **Text**, **Image**, **Group** (sub-flows)
- Drag a node into a group to join it, drag it out to leave; groups expand to fit
- Inline editing, accent colors, free resize with persisted sizes
- Drag, connect, multi-select, box select, snap to grid (8 px)
- Duplicate/self connections blocked; hover an edge to delete it
- Drag a connection into blank canvas to create and connect a node (upstream or downstream)
- Edge toolbar: label, color, solid/dashed/dotted line, arrow toggle
- Smart snapping to other nodes' edges/centers, dashed alignment guides while dragging
- Align / distribute / group from the selection toolbar
- Viewport persistence, zoom presets and minimap toggle in the bottom-left controls
- Right-click context menu: add nodes, duplicate, layer order, group, delete
- One-click auto layout (Dagre, loaded on demand)
- Undo/redo, copy/paste, duplicate
- Autosave to `localStorage`; versioned JSON import/export with schema migration
- Shortcut cheatsheet (`?`), empty-canvas onboarding

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b + vite build
npm run preview
```

## Quality

```bash
npm run typecheck  # tsc -b
npm run lint       # oxlint
npm test           # vitest run
```

CI runs typecheck, lint, unit tests, and a production build on every push and pull request.

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
| `?` | Keyboard shortcuts |

Double-click the canvas to add a note, right-click for the context menu, and drag the left/right handles to connect nodes.

## Structure

```
src/
  components/
    FlowCanvas.tsx        # React Flow container, menus, guides, overlays
    Toolbar.tsx           # add nodes, undo, layout, snap, import/export
    CanvasControls.tsx    # zoom presets, fit view, minimap toggle
    SelectionToolbar.tsx  # align / distribute / group
    EdgeToolbar.tsx       # edge label / color / dash / arrow
    StatusBar.tsx
    ContextMenu.tsx       # right-click actions
    KeyboardHelp.tsx      # shortcut cheatsheet
    EmptyState.tsx        # onboarding for an empty canvas
    nodes/                # Note, Text, Image, Group
    edges/                # Smoothstep edge with hover delete
  hooks/
    useAutoSave.ts        # debounced localStorage writes
    useCanvasShortcuts.ts
  lib/
    storage.ts            # schema v2, validation, migration, import/export
    geometry.ts           # sizes, absolute rects, descendants
    guides.ts             # smart snapping + alignment guide math
    layout.ts             # Dagre (dynamic import)
  store/
    canvasStore.ts        # nodes/edges/history/clipboard
    uiStore.ts            # snap toggle, help panel
```

Data model: `{ version: 2, nodes, edges, viewport? }`. Older `v1` snapshots are migrated on load; unknown fields and unsafe image URLs are dropped.

## Notes

- Everything stays in the browser. Image uploads are stored as data URLs, so very large images will hit the `localStorage` quota.
- `BASE_PATH` controls the Vite `base`; the Pages workflow builds with `/infinite-canvas/`.
