'use client';

import { create } from 'zustand';

interface UIState {
  consoleOpen: boolean;
  inspectorOpen: boolean;
  consoleFilter: string | null;
  nodeDetailNodeId: string | null;
  toggleConsole: () => void;
  toggleInspector: () => void;
  setConsoleFilter: (nodeId: string | null) => void;
  openInspector: () => void;
  closeInspector: () => void;
  openNodeDetail: (nodeId: string) => void;
  closeNodeDetail: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  consoleOpen: true,
  inspectorOpen: false,
  consoleFilter: null,
  nodeDetailNodeId: null,
  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setConsoleFilter: (nodeId) => set({ consoleFilter: nodeId }),
  openInspector: () => set({ inspectorOpen: true }),
  closeInspector: () => set({ inspectorOpen: false }),
  openNodeDetail: (nodeId) => set({ nodeDetailNodeId: nodeId }),
  closeNodeDetail: () => set({ nodeDetailNodeId: null }),
}));
