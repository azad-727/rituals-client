import { create } from 'zustand';

export const useDashboardStore = create((set, get) => ({
  // ─── Theme ─────────────────────────────────────────────
  isDarkMode: true,
  toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

  // ─── Auth ──────────────────────────────────────────────
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  userEmail: localStorage.getItem('userEmail') || null,
  userId: localStorage.getItem('userEmail') || null,

  loginSuccess: (token, email) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', email);
    set({ token, isAuthenticated: true, userEmail: email, userId: email });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    set({ token: null, isAuthenticated: false, userEmail: null, tasks: [], currentDate: '', dayEmoji: null });
  },

  // ─── Shared Tasks State (used by ROUTINE + PULSE) ─────
  tasks: [],
  currentDate: '',
  dayEmoji: null,

  setTasks: (tasks) => set({ tasks }),
  setCurrentDate: (currentDate) => set({ currentDate }),
  setDayEmoji: (dayEmoji) => set({ dayEmoji }),

  // Fetches today's tasks from the API and stores them globally.
  // Returns the full response data so callers can also read logDate etc.
  fetchTodayTasks: async () => {
    const { userId } = get();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/today/${userId}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const sortedTasks = (data.tasks || []).sort((a, b) =>
        (a.startTime || '00:00').localeCompare(b.startTime || '00:00')
      );
      const safeDate = data.logDate || data.logData || new Date().toLocaleDateString('en-CA');
      set({ tasks: sortedTasks, currentDate: safeDate, dayEmoji: data.dayEmoji || null });
      return data;
    } catch (err) {
      console.error('Store: Failed to fetch today tasks:', err);
      return null;
    }
  },

  // Syncs the current tasks array to the backend via PUT.
  syncTasks: async (updatedTasks) => {
    const { userId, currentDate } = get();
    const token = localStorage.getItem('token');
    set({ tasks: updatedTasks });
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/${userId}/${currentDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updatedTasks)
      });
    } catch (err) {
      console.error('Store: Failed to sync tasks:', err);
    }
  },

  // Syncs a day emoji via PATCH.
  syncDayEmoji: async (emoji) => {
    const { userId, currentDate } = get();
    const token = localStorage.getItem('token');
    set({ dayEmoji: emoji });
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/rituals/${userId}/${currentDate}/emoji`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ emoji })
      });
    } catch (err) {
      console.error('Store: Failed to sync day emoji:', err);
    }
  },
}));