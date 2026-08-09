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
 * Una opcion de comida con sus propios macros. La unidad de registro es la
 * COMIDA completa ("Seco de res"), no sus ingredientes.
 */
export interface MealOption {
  id: string
  name: string
  slots: MealSlot[] // en que comidas del dia aparece
  prot: number
  carb: number
  grasa: number
  fav?: boolean
}

/** Una comida registrada en el dia. */
export interface MealLog {
  id: string
  slot: MealSlot
  optionId: string | null // null si fue algo fuera del plan
  portion: number // 1 = porcion normal
  at: number
  /** Para "comi otra cosa": macros sueltos, sin opcion detras. */
  custom?: { name: string; prot: number; carb: number; grasa: number }
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
  options: MealOption[]
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
