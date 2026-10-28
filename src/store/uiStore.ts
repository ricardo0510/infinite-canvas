import { create } from "zustand";

type UiState = {
  snapToGrid: boolean;
  helpOpen: boolean;
  showMiniMap: boolean;
  toggleSnap: () => void;
  setHelpOpen: (open: boolean) => void;
  toggleMiniMap: () => void;
  setMiniMap: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  snapToGrid: true,
  helpOpen: false,
  showMiniMap: true,
  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setHelpOpen: (open) => set({ helpOpen: open }),
  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),
  setMiniMap: (open) => set({ showMiniMap: open }),
}));
