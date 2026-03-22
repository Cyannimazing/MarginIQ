import { create } from 'zustand';

type ViewMode = 'active' | 'archived' | 'trash';

interface UIState {
  isSidebarOpen: boolean;
  viewMode: ViewMode;
  currentRoute: string;
  activeFilter: string;
  setSidebarOpen: (isOpen: boolean) => void;
  setViewMode: (view: ViewMode) => void;
  setCurrentRoute: (route: string) => void;
  setActiveFilter: (filter: string) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  viewMode: 'active',
  currentRoute: 'Dashboard',
  activeFilter: 'All',
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  setViewMode: (view) => set({ viewMode: view }),
  setCurrentRoute: (route) => set({ currentRoute: route }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
