import { create } from 'zustand';

export const useDashboardStore = create((set) => ({
  activeTab: 'calendar', // Available: 'calendar', 'goals', 'analytics', 'skills', 'sprint'
  userId: 'user123',     // Hardcoded dummy user for now to connect seamlessly with Phase 1 backend
  isDarkMode: false,      // Defaulting to our premium Neon Terminal dark theme

  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
}));