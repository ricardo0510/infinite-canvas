# Infinite Canvas

A local-first infinite canvas built with React 19, TypeScript, [@xyflow/react](https://reactflow.dev), and Zustand.

## Features

- Infinite pan/zoom, minimap, fit view
- Custom note nodes with inline editing and four accent colors
- Drag, connect, multi-select, box select
- Undo/redo, copy/paste, duplicate
- Autosave to `localStorage`; JSON import/export

## Run

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` / `V` | Copy / paste selected nodes |
| `Ctrl/Cmd + D` | Duplicate selected nodes |
| `Ctrl/Cmd + S` | Save to localStorage |
| `Delete` / `Backspace` | Delete selected nodes |

Double-click the canvas to add a note. Drag the left/right handles to connect nodes.
