import type { AppSettings, DayLog, Macros, MealLog, MealOption, MealSlot, SetEntry, SplitDay } from '../types'
import { KCAL_PER_G, RULES } from './config'

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

export function weekdayOf(date: string): number {
  return parseDate(date)?.getDay() ?? 0
}

/** Los 7 dias de la semana calendario (lunes a domingo) que contiene `date`. */
export function weekDates(date = todayStr()): string[] {
  const wd = weekdayOf(date)
  const monday = addDays(date, wd === 0 ? -6 : 1 - wd)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Fraccion de la semana ya transcurrida contando hoy como completo. */
export function weekPace(dates: string[], today = todayStr()): number {
  const i = dates.indexOf(today)
  if (i < 0) return today > dates[dates.length - 1] ? 1 : 0
  return (i + 1) / dates.length
}

export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const WEEKDAY_MIN = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
export const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function headerDate(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

export function shortDate(date: string): string {
  const d = parseDate(date)
  if (!d) return date
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// --- Macros ---
export const ZERO: Macros = { prot: 0, carb: 0, grasa: 0 }

export function addMacros(a: Macros, b: Macros): Macros {
  return { prot: a.prot + b.prot, carb: a.carb + b.carb, grasa: a.grasa + b.grasa }
}

export function scaleMacros(m: Macros, f: number): Macros {
  return { prot: m.prot * f, carb: m.carb * f, grasa: m.grasa * f }
}

export function roundMacros(m: Macros): Macros {
  return { prot: Math.round(m.prot), carb: Math.round(m.carb), grasa: Math.round(m.grasa) }
}

export function kcal(m: Macros): number {
  return Math.round(m.prot * KCAL_PER_G.prot + m.carb * KCAL_PER_G.carb + m.grasa * KCAL_PER_G.grasa)
}

/**
 * Macros de referencia de una comida: la fraccion del objetivo diario que le
 * toca. Es lo que precarga una opcion nueva y un "comi otra cosa", asi que
 * sale de los numeros del usuario, no de una tabla fija.
 */
export function slotReference(settings: AppSettings, slot: MealSlot): Macros {
  return roundMacros(scaleMacros(settings.targets, settings.slotShare[slot] ?? 0))
}

export function findOption(options: MealOption[], id: string | null): MealOption | undefined {
  return id ? options.find(o => o.id === id) : undefined
}

/** Opciones disponibles para una comida, con los favoritos primero. */
export function optionsForSlot(options: MealOption[], slot: MealSlot): MealOption[] {
  return options
    .filter(o => o.slots.includes(slot))
    .sort((a, b) => Number(!!b.fav) - Number(!!a.fav))
}

/** Macros de una comida registrada, ya escalados por la porcion. */
export function mealMacros(log: MealLog, options: MealOption[]): Macros {
  const base = log.custom ?? findOption(options, log.optionId)
  if (!base) return ZERO
  return scaleMacros({ prot: base.prot, carb: base.carb, grasa: base.grasa }, log.portion)
}

export function mealName(log: MealLog, options: MealOption[]): string {
  return log.custom?.name ?? findOption(options, log.optionId)?.name ?? 'Comida eliminada'
}

/** Suma de todo lo comido en un dia. */
export function dayMacros(record: DayLog | undefined, options: MealOption[]): Macros {
  if (!record?.meals?.length) return ZERO
  return record.meals.reduce((acc, m) => addMacros(acc, mealMacros(m, options)), ZERO)
}

export function macrosForDate(records: DayLog[], date: string, options: MealOption[]): Macros {
  return dayMacros(getRecord(records, date), options)
}

/** Lo que falta para llegar al objetivo (puede ser negativo = te pasaste). */
export function remaining(target: Macros, eaten: Macros): Macros {
  return { prot: target.prot - eaten.prot, carb: target.carb - eaten.carb, grasa: target.grasa - eaten.grasa }
}

export function sumMacrosOver(records: DayLog[], dates: string[], options: MealOption[]): Macros {
  return dates.reduce((acc, d) => addMacros(acc, macrosForDate(records, d, options)), ZERO)
}

/** Lo registrado en una comida concreta del dia. */
export function mealsInSlot(record: DayLog | undefined, slot: MealSlot): MealLog[] {
  return (record?.meals ?? []).filter(m => m.slot === slot).sort((a, b) => a.at - b.at)
}

// --- Adherencia ---
/** Un dia cuenta como registrado si tiene al menos una comida. */
export function hasFoodLog(r: DayLog | undefined): boolean {
  return !!r?.meals?.length
}

export function loggedDays(records: DayLog[], dates: string[]): number {
  return dates.filter(d => hasFoodLog(getRecord(records, d))).length
}

/** Ratio consumido/objetivo por macro, acotado para la barra. */
export function ratio(eaten: number, target: number): number {
  if (target <= 0) return 0
  return eaten / target
}

/** Un dia esta en objetivo si los tres macros caen dentro de la tolerancia. */
export function dayOnTarget(eaten: Macros, target: Macros, tol: number): boolean {
  return (['prot', 'carb', 'grasa'] as const).every(k => {
    const r = ratio(eaten[k], target[k])
    return r >= 1 - tol && r <= 1 + tol
  })
}

export function adherence(records: DayLog[], dates: string[], settings: AppSettings): { onTarget: number; logged: number; total: number } {
  let onTarget = 0
  let logged = 0
  for (const d of dates) {
    const r = getRecord(records, d)
    if (!hasFoodLog(r)) continue
    logged++
    if (dayOnTarget(dayMacros(r, settings.options), settings.targets, settings.tolerance)) onTarget++
  }
  return { onTarget, logged, total: dates.length }
}

// --- Peso ---
export function getRecord(records: DayLog[], date: string): DayLog | undefined {
  return records.find(r => r.date === date)
}

export function lastActiveDate(records: DayLog[]): string | null {
  let last: string | null = null
  for (const r of records) if (!last || r.date > last) last = r.date
  return last
}

export function weightAvg(records: DayLog[], from: string, to: string): number | null {
  const vals = records.filter(r => r.weight != null && r.date >= from && r.date <= to).map(r => r.weight as number)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function weightTrend(records: DayLog[]): { delta: number; recent: number; prev: number } | null {
  const t = todayStr()
  const recent = weightAvg(records, addDays(t, -6), t)
  if (recent === null) return null
  const prev = weightAvg(records, addDays(t, -13), addDays(t, -7))
  if (prev === null) return null
  return { delta: Math.round((recent - prev) * 10) / 10, recent, prev }
}

export function weightSeries(records: DayLog[], days = RULES.weightChartDays): { date: string; weight: number }[] {
  const from = addDays(todayStr(), -(days - 1))
  return records
    .filter(r => r.weight != null && r.date >= from)
    .map(r => ({ date: r.date, weight: r.weight as number }))
}

// --- Proyeccion hacia la meta ---

export interface WeightProjection {
  /** Peso estimado en la fecha objetivo al ritmo actual. */
  projected: number
  /** Kg que separan la proyeccion de la meta (positivo = le falta, negativo = la supera). */
  gap: number
  recent: number
  perWeek: number
  daysLeft: number
  targetDate: string
  targetWeight: number
}

/**
 * Proyecta el peso a una fecha objetivo usando la tendencia semanal
 * (kg/semana de weightTrend). Devuelve null si falta la meta, si la fecha ya
 * paso o si no hay dos ventanas de datos para medir el ritmo.
 */
export function weightProjection(records: DayLog[], settings: AppSettings): WeightProjection | null {
  const { targetWeight, targetDate } = settings
  if (!targetWeight || !targetDate) return null
  const daysLeft = daysBetween(todayStr(), targetDate)
  if (daysLeft < 0) return null
  const trend = weightTrend(records)
  if (!trend) return null
  const projected = trend.recent + trend.delta * (daysLeft / 7)
  return {
    projected: Math.round(projected * 10) / 10,
    gap: Math.round((targetWeight - projected) * 10) / 10,
    recent: trend.recent,
    perWeek: trend.delta,
    daysLeft,
    targetDate,
    targetWeight,
  }
}

export function waistSeries(records: DayLog[], days = RULES.waistChartDays): { date: string; waist: number }[] {
  const from = addDays(todayStr(), -(days - 1))
  return records
    .filter(r => r.waist != null && r.date >= from)
    .map(r => ({ date: r.date, waist: r.waist as number }))
}

// --- Sueno ---
export function hmToMinutes(s?: string): number | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function sleepHours(bed?: string, wake?: string): number | null {
  const b = hmToMinutes(bed)
  const w = hmToMinutes(wake)
  if (b === null || w === null) return null
  let m = w - b
  if (m < 0) m += 1440
  return Math.round((m / 60) * 10) / 10
}

export function sleepRegularity(records: DayLog[]): number | null {
  const mins: number[] = []
  for (const d of lastNDates(7)) {
    const r = getRecord(records, d)
    if (!r) continue
    const h = sleepHours(r.bedTime, r.wakeTime)
    if (h !== null) mins.push(h * 60)
  }
  if (mins.length < 2) return null
  const mean = mins.reduce((a, b) => a + b, 0) / mins.length
  const variance = mins.reduce((a, b) => a + (b - mean) ** 2, 0) / mins.length
  return Math.round(Math.sqrt(variance))
}

// --- Veredicto ---
export type Verdict = 'welcome' | 'ok' | 'ajustar' | 'ejecucion' | 'regreso'

export function getVerdict(records: DayLog[], settings: AppSettings): Verdict {
  if (records.length === 0) return 'welcome'
  const t = todayStr()
  const last = lastActiveDate(records)
  if (last && daysBetween(last, t) >= RULES.absenceDays) return 'regreso'
  const dates = lastNDates(7)
  const a = adherence(records, dates, settings)
  if (a.logged < RULES.minLoggedDays) return 'ejecucion'
  if (a.onTarget < Math.ceil(a.logged * RULES.onTargetShare)) return 'ejecucion'
  const trend = weightTrend(records)
  if (trend && trend.delta < 0) return 'ok'
  return 'ajustar'
}

// --- Entrenamiento ---
export function splitDayForDate(split: SplitDay[], date: string): SplitDay | null {
  const wd = weekdayOf(date)
  return split.find(s => s.weekday === wd) ?? null
}

/** El entreno de un dia: lo elegido a mano si existe, si no lo que toca por split. */
export function workoutForDate(record: DayLog | undefined, split: SplitDay[], date: string): SplitDay | null {
  if (record && 'workoutId' in record) {
    if (record.workoutId === null) return null // descanso explicito
    const chosen = split.find(s => s.id === record.workoutId)
    if (chosen) return chosen
  }
  return splitDayForDate(split, date)
}

export function isRestDay(record: DayLog | undefined, split: SplitDay[], date: string): boolean {
  return workoutForDate(record, split, date) === null
}

export function makeEmptySets(count: number): SetEntry[] {
  return Array.from({ length: count }, () => ({ weight: '', reps: '' }))
}

/** Mejor peso levantado en un ejercicio dentro de un rango de fechas. */
export function bestWeight(records: DayLog[], exerciseId: string, dates: string[]): number | null {
  let best: number | null = null
  for (const d of dates) {
    const sets = getRecord(records, d)?.sets?.[exerciseId]
    if (!sets) continue
    for (const s of sets) {
      const w = parseFloat(s.weight)
      if (!isNaN(w) && (best === null || w > best)) best = w
    }
  }
  return best
}

/** Ejercicios que bajaron de peso respecto a la semana anterior. */
export function strengthDrops(records: DayLog[], split: SplitDay[]): { name: string; from: number; to: number }[] {
  const w = RULES.strengthWindowDays
  const cur = lastNDates(w)
  const prev = cur.map(d => addDays(d, -w))
  const out: { name: string; from: number; to: number }[] = []
  // Un mismo ejercicio puede estar en dos dias del split (p. ej. Cable Row en
  // Upper y Pull) y compartir id: se reporta una sola vez.
  const seen = new Set<string>()
  for (const day of split) {
    for (const ex of day.exercises) {
      if (seen.has(ex.id)) continue
      seen.add(ex.id)
      const a = bestWeight(records, ex.id, prev)
      const b = bestWeight(records, ex.id, cur)
      if (a !== null && b !== null && b < a) out.push({ name: ex.name, from: a, to: b })
    }
  }
  return out
}
