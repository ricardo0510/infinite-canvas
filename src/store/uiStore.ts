import { create } from "zustand";

type UiState = {
  snapToGrid: boolean;
  helpOpen: boolean;
  commandOpen: boolean;
  showMiniMap: boolean;
  aiPanelNodeId: string | null;
  aiSettingsOpen: boolean;
  toggleSnap: () => void;
  setHelpOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  toggleMiniMap: () => void;
  setMiniMap: (open: boolean) => void;
  setAiPanelNode: (id: string | null) => void;
  setAiSettingsOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  snapToGrid: true,
  helpOpen: false,
  commandOpen: false,
  showMiniMap: true,
  aiPanelNodeId: null,
  aiSettingsOpen: false,
  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setHelpOpen: (open) => set({ helpOpen: open, ...(open ? { commandOpen: false } : {}) }),
  setCommandOpen: (open) => set({ commandOpen: open, ...(open ? { helpOpen: false } : {}) }),
  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),
  setMiniMap: (open) => set({ showMiniMap: open }),
  setAiPanelNode: (id) => set({ aiPanelNodeId: id }),
  setAiSettingsOpen: (open) => set({ aiSettingsOpen: open }),
}));
