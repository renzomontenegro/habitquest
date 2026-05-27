import type { AppState } from '../types'
import { DEFAULT_ACHIEVEMENTS } from './achievements'

const STORAGE_KEY = 'habitquest_state'

const defaultState: AppState = {
  profile: {
    totalXP: 0,
    level: 1,
    dailyXPGoal: 20,
    streakFreezes: 0,
    lastActiveDate: '',
  },
  habits: [],
  habitLogs: [],
  goals: [],
  goalContributions: [],
  achievements: DEFAULT_ACHIEVEMENTS,
  weeklyLeagues: [],
  settings: {
    soundEnabled: false,
  },
}

export const storage = {
  load(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return structuredClone(defaultState)
      const parsed = JSON.parse(raw) as Partial<AppState>
      return {
        ...structuredClone(defaultState),
        ...parsed,
        profile: { ...defaultState.profile, ...parsed.profile },
        settings: { ...defaultState.settings, ...parsed.settings },
        achievements: DEFAULT_ACHIEVEMENTS.map(def => {
          const saved = parsed.achievements?.find(a => a.id === def.id)
          return saved ? { ...def, unlockedAt: saved.unlockedAt } : { ...def }
        }),
      }
    } catch {
      return structuredClone(defaultState)
    }
  },

  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      console.warn('No se pudo guardar en localStorage')
    }
  },

  exportJSON(state: AppState): string {
    return JSON.stringify(state, null, 2)
  },

  importJSON(json: string): AppState | null {
    try {
      const parsed = JSON.parse(json)
      if (parsed.profile && parsed.habits) return parsed as AppState
      return null
    } catch {
      return null
    }
  },
}
