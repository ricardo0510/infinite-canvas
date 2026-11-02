import { create } from "zustand";

export type MediaPreviewState =
  | { kind: "image" | "video"; src: string; title: string }
  | { kind: "text"; text: string; title: string };

type UiState = {
  snapToGrid: boolean;
  helpOpen: boolean;
  commandOpen: boolean;
  showMiniMap: boolean;
  aiPanelNodeId: string | null;
  aiSettingsOpen: boolean;
  mediaPreview: MediaPreviewState | null;
  agentOpen: boolean;
  toggleSnap: () => void;
  setHelpOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  toggleMiniMap: () => void;
  setMiniMap: (open: boolean) => void;
  setAiPanelNode: (id: string | null) => void;
  setAiSettingsOpen: (open: boolean) => void;
  setMediaPreview: (preview: MediaPreviewState | null) => void;
  setAgentOpen: (open: boolean) => void;
  toggleAgentOpen: () => void;
};

function defaultAgentOpen(): boolean {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= 1200;
}

export const useUiStore = create<UiState>((set) => ({
  snapToGrid: true,
  helpOpen: false,
  commandOpen: false,
  showMiniMap: true,
  aiPanelNodeId: null,
  aiSettingsOpen: false,
  mediaPreview: null,
  agentOpen: defaultAgentOpen(),
  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setHelpOpen: (open) => set({ helpOpen: open, ...(open ? { commandOpen: false } : {}) }),
  setCommandOpen: (open) => set({ commandOpen: open, ...(open ? { helpOpen: false } : {}) }),
  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),
  setMiniMap: (open) => set({ showMiniMap: open }),
  setAiPanelNode: (id) => set({ aiPanelNodeId: id }),
  setAiSettingsOpen: (open) => set({ aiSettingsOpen: open }),
  setMediaPreview: (preview) => set({ mediaPreview: preview }),
  setAgentOpen: (open) => set({ agentOpen: open }),
  toggleAgentOpen: () => set((state) => ({ agentOpen: !state.agentOpen })),
}));
