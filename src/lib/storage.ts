import type { AppSettings, AppState, DayLog, Macros, MealLog, MealSlot, SavedMeal, SetEntry, SplitDay } from '../types'
import {
  DEFAULT_SLEEP_TARGET, DEFAULT_SLOT_SHARE, DEFAULT_TARGETS, DEFAULT_TOLERANCE,
} from './config'
import { normTime, todayStr, uid } from './logic'

const STORAGE_KEY = 'sistema_state'

/**
 * Una instalacion nueva arranca SIN comidas y SIN rutina: el plan es del
 * usuario, no del codigo. El onboarding pide los objetivos y de ahi en
 * adelante todo se crea desde la app.
 */
const defaultSettings = (): AppSettings => ({
  targets: { ...DEFAULT_TARGETS },
  slotShare: { ...DEFAULT_SLOT_SHARE },
  savedMeals: [],
  split: [],
  sleepTarget: DEFAULT_SLEEP_TARGET,
  tolerance: DEFAULT_TOLERANCE,
  startDate: todayStr(),
  setupDone: false,
})

export const defaultState = (): AppState => ({
  records: [],
  settings: defaultSettings(),
})

// --- Helpers de validacion ---
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const SLOT_IDS: MealSlot[] = ['desayuno', 'almuerzo', 'cena', 'extra']

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && isFinite(v) ? v : fallback
}

function optNum(v: unknown): number | undefined {
  return typeof v === 'number' && isFinite(v) ? v : undefined
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function optStr(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function cleanMealLog(v: unknown): MealLog | null {
  if (!isObj(v)) return null
  const slot = SLOT_IDS.includes(v.slot as MealSlot) ? (v.slot as MealSlot) : null
  if (!slot) return null

  // Sin custom no hay macros que sumar: la comida desaparece. (Los registros
  // del modelo con catalogo quedaban sin macros una vez eliminado el catalogo.)
  let custom: MealLog['custom']
  if (isObj(v.custom)) {
    const name = str(v.custom.name).trim()
    if (name) {
      custom = {
        name,
        prot: Math.max(0, num(v.custom.prot, 0)),
        carb: Math.max(0, num(v.custom.carb, 0)),
        grasa: Math.max(0, num(v.custom.grasa, 0)),
      }
    }
  }
  if (!custom) return null

  const note = optStr(v.note)
  return {
    id: str(v.id) || uid('m'),
    slot,
    portion: Math.max(0, num(v.portion, 1)) || 1,
    at: num(v.at, 0),
    custom,
    ...(note ? { note } : {}),
    ...(v.ai === true ? { ai: true } : {}),
  }
}

function cleanSets(v: unknown): Record<string, SetEntry[]> | undefined {
  if (!isObj(v)) return undefined
  const out: Record<string, SetEntry[]> = {}
  for (const [key, val] of Object.entries(v)) {
    if (!Array.isArray(val)) continue
    const list = val.filter(isObj).map(s => ({ weight: str(s.weight), reps: str(s.reps) }))
    if (list.some(s => s.weight || s.reps)) out[key] = list
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function cleanSplit(v: unknown): SplitDay | null {
  if (!isObj(v)) return null
  const name = str(v.name).trim()
  if (!name) return null
  const wd = v.weekday
  const weekday = typeof wd === 'number' && wd >= 0 && wd <= 6 ? wd : null
  const rawEx = Array.isArray(v.exercises) ? v.exercises : []
  const exercises = rawEx
    .filter(isObj)
    .map(e => ({
      id: str(e.id) || uid('e'),
      name: str(e.name).trim(),
      sets: Math.min(10, Math.max(1, Math.round(num(e.sets, 3)))),
      reps: str(e.reps, '8-10') || '8-10',
    }))
    .filter(e => e.name)
  return { id: str(v.id) || uid('s'), name, weekday, exercises }
}

function cleanTargets(v: unknown, fallback: Macros): Macros {
  if (!isObj(v)) return { ...fallback }
  return {
    prot: Math.max(0, num(v.prot, fallback.prot)),
    carb: Math.max(0, num(v.carb, fallback.carb)),
    grasa: Math.max(0, num(v.grasa, fallback.grasa)),
  }
}

// ---------------------------------------------------------------------------
// Migracion desde el modelo viejo (recetas sin macros)
// ---------------------------------------------------------------------------

/**
 * Se conservan las medidas del cuerpo y las series de gym: son numeros reales
 * que el usuario escribio. Lo que NO se conserva del formato viejo es el plan
 * (recetas, rutina) ni las respuestas de comida ('sí'/'otra'/'no'), que no
 * tenian macros detras y solo servirian para resucitar un plan que no eligio.
 *
 * Las series viejas estaban indexadas por nombre de ejercicio y se dejan asi:
 * vuelven a mostrarse en cuanto exista un ejercicio con ese mismo nombre.
 */
function cleanRecord(v: unknown): DayLog | null {
  if (!isObj(v) || typeof v.date !== 'string') return null
  const rec: DayLog = { date: v.date }

  if (optNum(v.weight) != null) rec.weight = optNum(v.weight)
  if (optNum(v.steps) != null) rec.steps = optNum(v.steps)
  if (optNum(v.waist) != null) rec.waist = optNum(v.waist)
  // Hora normalizada: un valor no-conformante haria que el input la muestre
  // como invalida (tooltip nativo) y que el sueno no calcule.
  const bed = normTime(optStr(v.bedTime) ?? '')
  if (bed) rec.bedTime = bed
  const wake = normTime(optStr(v.wakeTime) ?? '')
  if (wake) rec.wakeTime = wake

  if (Array.isArray(v.meals)) {
    const meals = v.meals.map(cleanMealLog).filter((m): m is MealLog => m !== null)
    if (meals.length > 0) rec.meals = meals
  }

  if (Array.isArray(v.skipped)) {
    const slots = v.skipped.filter((x): x is MealSlot =>
      typeof x === 'string' && SLOT_IDS.includes(x as MealSlot))
    if (slots.length > 0) rec.skipped = [...new Set(slots)]
  }

  const sets = cleanSets(v.sets)
  if (sets) rec.sets = sets

  if ('workoutId' in v) {
    rec.workoutId = v.workoutId === null ? null : str(v.workoutId) || undefined
  }

  return rec
}

/**
 * Las versiones 2.0-2.2 sembraban comidas y rutina de ejemplo, y eso quedo
 * GUARDADO en el estado del usuario: quitar las constantes del codigo no basta
 * para hacerlas desaparecer. Se reconocen por el id, que la app escribia a mano
 * con guion bajo (`o_muffins`, `s_upper`). Los ids que genera `uid()` nunca
 * llevan guion bajo, asi que nada creado por el usuario cae en este filtro.
 * (Hoy solo aplica a la rutina: el catalogo de comidas ya no existe.)
 */
function isSeededId(id: string): boolean {
  return /^[a-z]+_/.test(id)
}

function cleanShare(v: unknown): Record<MealSlot, number> {
  const out = { ...DEFAULT_SLOT_SHARE }
  if (!isObj(v)) return out
  for (const slot of SLOT_IDS) {
    const n = v[slot]
    if (typeof n === 'number' && isFinite(n) && n >= 0 && n <= 1) out[slot] = n
  }
  return out
}

/** Comidas repetidas: solo las del usuario, top 30 para no crecer sin limite. */
function cleanSavedMeals(v: unknown): SavedMeal[] {
  if (!Array.isArray(v)) return []
  return v
    .filter(isObj)
    .map(m => {
      const name = str(m.name).trim()
      if (!name) return null
      return {
        id: str(m.id) || uid('sm'),
        name,
        prot: Math.max(0, num(m.prot, 0)),
        carb: Math.max(0, num(m.carb, 0)),
        grasa: Math.max(0, num(m.grasa, 0)),
        ...(optStr(m.note) ? { note: optStr(m.note) } : {}),
      }
    })
    .filter((m): m is SavedMeal => m !== null)
    .slice(0, 30)
}

function sanitize(value: unknown): AppState {
  const base = defaultState()
  if (!isObj(value)) return base

  const s = isObj(value.settings) ? value.settings : {}

  // La rutina es SIEMPRE del usuario. Si el estado guardado no la trae, la
  // app arranca sin ella: no se siembra nada, ni siquiera al migrar.
  const split = (Array.isArray(s.split) ? s.split : [])
    .map(cleanSplit)
    .filter((d): d is SplitDay => d !== null && !isSeededId(d.id))

  const settings: AppSettings = {
    targets: cleanTargets(s.targets, DEFAULT_TARGETS),
    slotShare: cleanShare(s.slotShare),
    savedMeals: cleanSavedMeals(s.savedMeals),
    split,
    sleepTarget: Math.min(14, Math.max(1, num(s.sleepTarget, DEFAULT_SLEEP_TARGET))),
    tolerance: Math.min(0.5, Math.max(0.01, num(s.tolerance, DEFAULT_TOLERANCE))),
    // Meta de peso opcional: peso > 0 y fecha con formato valido, o no va.
    ...(num(s.targetWeight, 0) > 0 ? { targetWeight: num(s.targetWeight, 0) } : {}),
    ...(optStr(s.targetDate) ? { targetDate: optStr(s.targetDate) as string } : {}),
    startDate: optStr(s.startDate) ?? base.settings.startDate,
    // Solo se salta el onboarding quien ya definio objetivos en esta version.
    setupDone: s.setupDone === true,
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
