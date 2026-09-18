/**
 * Local Storage Persistence Service
 * Resilient offline persistence for active nap sessions, user preferences, and nap logs.
 */

const STORAGE_KEYS = {
  ACTIVE_SESSION: 'nap_calc_active_session',
  USER_PREFERENCES: 'nap_calc_user_prefs',
  NAP_LOGS: 'nap_calc_nap_logs'
};

const StorageService = {
  // Check if localStorage is available
  isSupported() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  },

  // Active Nap Session (for recovery if page is refreshed)
  saveActiveSession(session) {
    if (!this.isSupported()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } catch (e) {
      console.error('Failed to save active nap session:', e);
    }
  },

  getActiveSession() {
    if (!this.isSupported()) return null;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to parse active nap session:', e);
      return null;
    }
  },

  clearActiveSession() {
    if (!this.isSupported()) return;
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    } catch (e) {
      console.error('Failed to clear active session:', e);
    }
  },

  // User Preferences (typical bedtime, preferred buffer, etc.)
  savePreferences(prefs) {
    if (!this.isSupported()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  },

  getPreferences() {
    if (!this.isSupported()) {
      return { wakeBufferMinutes: 15, typicalBedtimeHour: 23, nighttimeSleepHours: 7 };
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return data ? JSON.parse(data) : { wakeBufferMinutes: 15, typicalBedtimeHour: 23, nighttimeSleepHours: 7 };
    } catch (e) {
      return { wakeBufferMinutes: 15, typicalBedtimeHour: 23, nighttimeSleepHours: 7 };
    }
  },

  // Nap Logs (P1 local history repository)
  saveNapLog(logEntry) {
    if (!this.isSupported()) return;
    try {
      const existing = this.getNapLogs();
      existing.unshift(logEntry);
      localStorage.setItem(STORAGE_KEYS.NAP_LOGS, JSON.stringify(existing.slice(0, 50))); // Keep last 50
    } catch (e) {
      console.error('Failed to append nap log:', e);
    }
  },

  getNapLogs() {
    if (!this.isSupported()) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NAP_LOGS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageService };
}
