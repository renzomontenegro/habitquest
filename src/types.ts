/** Una fecha objetivo: nombre del evento, dia y peso al que llegar. */
export interface Goal {
  id: string
  name: string
  date: string // YYYY-MM-DD
  targetWeight: number
}

// --- Registro diario: solo el peso ---
export interface DayLog {
  date: string // YYYY-MM-DD
  weight?: number // peso en ayunas
}

// --- Ajustes ---
export interface AppSettings {
  /** Metas por evento (cumples, bodas...). La mas proxima manda. */
  goals: Goal[]
  startDate: string
}

// --- Estado global ---
export interface AppState {
  records: DayLog[]
  settings: AppSettings
}
