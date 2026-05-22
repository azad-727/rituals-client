import { create } from 'zustand';
export const useDashboardStore = create((set) => ({
  // Existing state
  isDarkMode: true,
  
  // 🔐 NEW AUTHENTICATION STATE
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  userEmail: localStorage.getItem('userEmail') || null,
  userId: localStorage.getItem('userEmail') || null,
  // Auth Actions
  loginSuccess: (token, email) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', email);
    set({ token, isAuthenticated: true, userEmail: email,userId: email });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    set({ token: null, isAuthenticated: false, userEmail: null });
  },

  toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
}));