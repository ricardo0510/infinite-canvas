import { create } from "zustand";

type UiState = {
  snapToGrid: boolean;
  helpOpen: boolean;
  commandOpen: boolean;
  showMiniMap: boolean;
  toggleSnap: () => void;
  setHelpOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  toggleMiniMap: () => void;
  setMiniMap: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  snapToGrid: true,
  helpOpen: false,
  commandOpen: false,
  showMiniMap: true,
  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setHelpOpen: (open) => set({ helpOpen: open, ...(open ? { commandOpen: false } : {}) }),
  setCommandOpen: (open) => set({ commandOpen: open, ...(open ? { helpOpen: false } : {}) }),
  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),
  setMiniMap: (open) => set({ showMiniMap: open }),
}));
