import type { AppSettings, AppState, DayLog, Goal } from '../types'
import { todayStr, uid } from './logic'

const STORAGE_KEY = 'sistema_state'

const defaultSettings = (): AppSettings => ({
  goals: [],
  startDate: todayStr(),
})

export const defaultState = (): AppState => ({
  records: [],
  settings: defaultSettings(),
})

// --- Helpers de validacion ---
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && isFinite(v) ? v : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/**
 * De cada dia solo sobrevive el peso. Todo lo demas que guardaron las
 * versiones anteriores (comidas, pasos, sueno, cintura, entrenos) se descarta
 * al cargar: la app ya no lo usa.
 */
function cleanRecord(v: unknown): DayLog | null {
  if (!isObj(v) || typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return null
  const w = v.weight
  if (typeof w !== 'number' || !isFinite(w) || w <= 0) return null
  return { date: v.date, weight: w }
}

/** Metas por evento: top 20 para no crecer sin limite. */
function cleanGoal(v: unknown): Goal | null {
  if (!isObj(v)) return null
  const name = str(v.name).trim()
  const date = str(v.date)
  const w = num(v.targetWeight, 0)
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(w > 0)) return null
  return { id: str(v.id) || uid('g'), name, date, targetWeight: Math.round(w * 10) / 10 }
}

function sanitize(value: unknown): AppState {
  const base = defaultState()
  if (!isObj(value)) return base

  const s = isObj(value.settings) ? value.settings : {}

  const goals = (Array.isArray(s.goals) ? s.goals : [])
    .map(cleanGoal)
    .filter((g): g is Goal => g !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 20)

  const settings: AppSettings = {
    goals,
    startDate: typeof s.startDate === 'string' && s.startDate ? s.startDate : base.settings.startDate,
  }

  const rawRecords = Array.isArray(value.records) ? value.records : []
  const records = rawRecords
    .map(cleanRecord)
    .filter((r): r is DayLog => r !== null)
  records.sort((a, b) => (a.date < b.date ? -1 : 1))

  return { records, settings }
}

export const storage = {
  load(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return defaultState()
      return sanitize(JSON.parse(raw))
    } catch {
      return defaultState()
    }
  },

  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      console.warn('No se pudo guardar en localStorage')
    }
  },

  clear(): void {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* nada que hacer */ }
  },

  sanitize,

  exportJSON(state: AppState): string {
    return JSON.stringify(state, null, 2)
  },

  importJSON(json: string): AppState | null {
    try {
      const parsed: unknown = JSON.parse(json)
      if (!isObj(parsed) || !Array.isArray(parsed.records)) return null
      return sanitize(parsed)
    } catch {
      return null
    }
  },
}
