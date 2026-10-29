import { create } from "zustand";

export type MediaPreviewState = {
  kind: "image" | "video";
  src: string;
  title: string;
};

type UiState = {
  snapToGrid: boolean;
  helpOpen: boolean;
  commandOpen: boolean;
  showMiniMap: boolean;
  aiPanelNodeId: string | null;
  aiSettingsOpen: boolean;
  mediaPreview: MediaPreviewState | null;
  toggleSnap: () => void;
  setHelpOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  toggleMiniMap: () => void;
  setMiniMap: (open: boolean) => void;
  setAiPanelNode: (id: string | null) => void;
  setAiSettingsOpen: (open: boolean) => void;
  setMediaPreview: (preview: MediaPreviewState | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  snapToGrid: true,
  helpOpen: false,
  commandOpen: false,
  showMiniMap: true,
  aiPanelNodeId: null,
  aiSettingsOpen: false,
  mediaPreview: null,
  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setHelpOpen: (open) => set({ helpOpen: open, ...(open ? { commandOpen: false } : {}) }),
  setCommandOpen: (open) => set({ commandOpen: open, ...(open ? { helpOpen: false } : {}) }),
  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),
  setMiniMap: (open) => set({ showMiniMap: open }),
  setAiPanelNode: (id) => set({ aiPanelNodeId: id }),
  setAiSettingsOpen: (open) => set({ aiSettingsOpen: open }),
  setMediaPreview: (preview) => set({ mediaPreview: preview }),
}));
