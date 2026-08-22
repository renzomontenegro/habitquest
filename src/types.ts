// --- Macros ---
export interface Macros {
  prot: number
  carb: number
  grasa: number
}

export type MacroKey = keyof Macros

// --- Comidas ---
export type MealSlot = 'desayuno' | 'almuerzo' | 'cena' | 'extra'

/**
 * Una comida registrada. No hay catalogo: los macros de la comida vienen de
 * `custom`. Cuando se registro con foto + texto, la IA los estimo (`ai`).
 */
export interface MealLog {
  id: string
  slot: MealSlot
  portion: number // 1 = porcion normal
  at: number
  /** Macros y nombre de la comida. */
  custom?: { name: string; prot: number; carb: number; grasa: number }
  /** Comentario del usuario (lo que le dio contexto a la IA). */
  note?: string
  /** true si los macros los estimo la IA a partir de una foto. */
  ai?: boolean
}

// --- Entrenamiento ---
export interface Exercise {
  id: string
  name: string
  sets: number
  reps: string
}

/** Un dia del split. `weekday` 0-6 (dom-sab), null si no tiene dia fijo. */
export interface SplitDay {
  id: string
  name: string
  weekday: number | null
  exercises: Exercise[]
}

export interface SetEntry {
  weight: string
  reps: string
}

// --- Registro diario ---
export interface DayLog {
  date: string // YYYY-MM-DD
  weight?: number // peso en ayunas
  steps?: number
  waist?: number // cintura, semanal
  bedTime?: string // HH:MM
  wakeTime?: string // HH:MM
  meals?: MealLog[]
  workoutId?: string | null // id de SplitDay; null = descanso
  sets?: Record<string, SetEntry[]> // por id de ejercicio
}

// --- Ajustes ---
export interface AppSettings {
  targets: Macros // objetivo diario
  /** Que fraccion del objetivo diario va en cada comida (0-1). */
  slotShare: Record<MealSlot, number>
  split: SplitDay[]
  /** Horas de sueno objetivo, para la linea de referencia del grafico. */
  sleepTarget: number
  /** Margen para dar un dia por cumplido (0.12 = ±12%). */
  tolerance: number
  /** Meta de peso: hacia donde va la tendencia. Sin estos no hay proyeccion. */
  targetWeight?: number
  targetDate?: string
  startDate: string
  /** false hasta que el usuario define sus objetivos por primera vez. */
  setupDone: boolean
}

// --- Estado global ---
export interface AppState {
  records: DayLog[]
  settings: AppSettings
}
