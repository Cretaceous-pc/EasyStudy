import { create } from 'zustand';
import type { FileObject } from '../types/material';

export type MainView = 'chat' | 'resources' | 'path' | 'profile';

interface LayoutStore {
  showDirectory: boolean;
  currentFile: FileObject | null;
  splitterRatio: number;
  isChatExpanded: boolean;
  scrollPositions: Map<number, number>;
  activeView: MainView;

  toggleDirectory: () => void;
  setShowDirectory: (show: boolean) => void;
  setCurrentFile: (file: FileObject | null) => void;
  setSplitterRatio: (ratio: number) => void;
  toggleChatExpand: () => void;
  setChatExpanded: (expanded: boolean) => void;
  saveScrollPosition: (fileId: number, pos: number) => void;
  getScrollPosition: (fileId: number) => number | undefined;
  setActiveView: (view: MainView) => void;
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  showDirectory: false,
  currentFile: null,
  splitterRatio: 0.75,
  isChatExpanded: false,
  scrollPositions: new Map(),
  activeView: 'chat',

  toggleDirectory: () => set((s) => ({ showDirectory: !s.showDirectory })),
  setShowDirectory: (show) => set({ showDirectory: show }),

  setCurrentFile: (file) => set({ currentFile: file }),

  setSplitterRatio: (ratio) =>
    set({ splitterRatio: Math.min(0.85, Math.max(0.3, ratio)) }),

  toggleChatExpand: () => set((s) => ({ isChatExpanded: !s.isChatExpanded })),
  setChatExpanded: (expanded) => set({ isChatExpanded: expanded }),

  saveScrollPosition: (fileId, pos) => {
    const newMap = new Map(get().scrollPositions);
    newMap.set(fileId, pos);
    set({ scrollPositions: newMap });
  },

  getScrollPosition: (fileId) => get().scrollPositions.get(fileId),

  setActiveView: (view) => {
    set({ activeView: view });
    if (view !== 'chat') {
      set({ showDirectory: false });
    }
  },
}));
