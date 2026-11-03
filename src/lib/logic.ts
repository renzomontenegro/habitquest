import type { DayLog, Goal } from '../types'

// --- Ids ---
export function uid(prefix = ''): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${rnd}`
}

// --- Fechas ---
export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10)
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return new Date(y, mo - 1, d)
}

export function daysBetween(a: string, b: string): number {
  const da = parseDate(a)?.getTime() ?? 0
  const db = parseDate(b)?.getTime() ?? 0
  return Math.round((db - da) / 86400000)
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  if (!d) return s
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function lastNDates(n: number, end = todayStr()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))
}

export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function headerDate(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

export function shortDate(date: string): string {
  const d = parseDate(date)
  if (!d) return date
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

// --- Metas ---
/** La meta mas proxima sin pasar (la que manda en el home). */
export function nearestGoal(goals: Goal[], from = todayStr()): Goal | null {
  const upcoming = goals
    .filter(g => g.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date))
  return upcoming[0] ?? null
}

// --- Peso ---
export function getRecord(records: DayLog[], date: string): DayLog | undefined {
  return records.find(r => r.date === date)
}

/** Ultimo pesaje hasta `to` (inclusive). */
export function latestWeigh(records: DayLog[], to = todayStr()): { date: string; weight: number } | null {
  let best: { date: string; weight: number } | null = null
  for (const r of records) {
    if (r.weight == null || r.date > to) continue
    if (!best || r.date > best.date) best = { date: r.date, weight: r.weight }
  }
  return best
}

/** Peso del registro mas cercano a `date` (para arrancar la rueda de pesaje). */
export function nearestWeight(records: DayLog[], date: string, span = 60): number | null {
  for (let i = 1; i <= span; i++) {
    const w = getRecord(records, addDays(date, -i))?.weight
    if (w != null) return w
  }
  return null
}

export function weightAvg(records: DayLog[], from: string, to: string): number | null {
  const vals = records.filter(r => r.weight != null && r.date >= from && r.date <= to).map(r => r.weight as number)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/**
 * Ritmo real en kg/semana: promedio de los ultimos 7 dias contra el de los 7
 * anteriores. Negativo = bajando. Null si no hay dos ventanas con datos.
 */
export function weeklyPace(records: DayLog[], date = todayStr()): number | null {
  const recent = weightAvg(records, addDays(date, -6), date)
  const prev = weightAvg(records, addDays(date, -13), addDays(date, -7))
  if (recent === null || prev === null) return null
  return Math.round((recent - prev) * 10) / 10
}

// --- Estado de una meta ---
export interface GoalStatus {
  daysLeft: number
  /** Ultimo peso registrado. */
  current: number | null
  /** Kg que faltan (positivo = hay que bajar, negativo = ya la superaste). */
  remaining: number | null
  /** Kg/semana que hay que bajar desde hoy para llegar. */
  neededPerWeek: number | null
  /** Ritmo real de los ultimos 7 dias contra los 7 anteriores. */
  actualPerWeek: number | null
  /** Peso estimado el dia de la meta al ritmo actual. */
  projected: number | null
}

export function goalStatus(records: DayLog[], goal: Goal, today = todayStr()): GoalStatus {
  const daysLeft = daysBetween(today, goal.date)
  const current = latestWeigh(records, today)?.weight ?? null
  const remaining = current != null ? Math.round((current - goal.targetWeight) * 10) / 10 : null
  const neededPerWeek = remaining != null && daysLeft > 0 && remaining > 0
    ? Math.round((remaining / (daysLeft / 7)) * 100) / 100
    : null
  const actualPerWeek = weeklyPace(records, today)
  const projected = current != null && actualPerWeek != null && daysLeft > 0
    ? Math.round((current + actualPerWeek * (daysLeft / 7)) * 10) / 10
    : null
  return { daysLeft, current, remaining, neededPerWeek, actualPerWeek, projected }
}
