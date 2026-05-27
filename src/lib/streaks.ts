import { format, subDays, parseISO, differenceInCalendarDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { GAME_CONFIG } from './gameConfig'
import type { HabitLog, Habit, UserProfile, WeeklyLeague, LeagueTier } from '../types'

// Fecha de hoy en formato YYYY-MM-DD
export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// XP ganado en un día específico (solo de hábitos)
// Si un hábito fue borrado, el log huérfano usa 10 XP por defecto
export function dailyXP(logs: HabitLog[], habits: Habit[], date: string): number {
  const dayLogs = logs.filter(l => l.date === date && l.completed)
  let xp = 0
  for (const log of dayLogs) {
    const habit = habits.find(h => h.id === log.habitId)
    xp += habit ? habit.xpReward : 10 // default XP para logs huérfanos
  }
  if (isPerfectDay(logs, habits, date)) {
    xp += GAME_CONFIG.xp.perfectDayBonus
  }
  return xp
}

// ¿Se completaron TODOS los hábitos del día?
// Requiere al menos 2 hábitos activos para que cuente (evita desbloqueo trivial)
export function isPerfectDay(logs: HabitLog[], habits: Habit[], date: string): boolean {
  if (habits.length < 2) return false
  const activeHabits = habits.filter(h => h.createdAt <= date)
  if (activeHabits.length < 2) return false
  return activeHabits.every(h => logs.some(l => l.habitId === h.id && l.date === date && l.completed))
}

// Racha global almacenada — se actualiza hacia adelante, nunca retroactivamente.
// Llamar al abrir la app o al completar un hábito.
export function updateStreak(
  logs: HabitLog[],
  habits: Habit[],
  profile: UserProfile
): { currentStreak: number; streakDate: string; streakFreezes: number; usedFreeze: boolean } {
  const todayStr = today()
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  // Si ya actualizamos hoy, solo verificar si hoy cumple
  if (profile.streakDate === todayStr) {
    const todayMet = dailyXP(logs, habits, todayStr) >= profile.dailyXPGoal
    return {
      currentStreak: todayMet ? Math.max(profile.currentStreak, 1) : profile.currentStreak,
      streakDate: todayStr,
      streakFreezes: profile.streakFreezes,
      usedFreeze: false,
    }
  }

  // Primera vez usando la app (sin historial)
  if (!profile.streakDate) {
    const todayMet = dailyXP(logs, habits, todayStr) >= profile.dailyXPGoal
    return {
      currentStreak: todayMet ? 1 : 0,
      streakDate: todayStr,
      streakFreezes: profile.streakFreezes,
      usedFreeze: false,
    }
  }

  // Calcular días perdidos desde la última vez
  const daysMissed = differenceInCalendarDays(new Date(), parseISO(profile.streakDate))
  let streak = profile.currentStreak
  let freezes = profile.streakFreezes
  let usedFreeze = false

  if (daysMissed === 1) {
    // Ayer fue el último día de racha — verificar si ayer cumplió
    const yesterdayMet = dailyXP(logs, habits, yesterdayStr) >= profile.dailyXPGoal
    if (yesterdayMet) {
      streak++ // ayer sumó
    } else if (freezes > 0) {
      freezes--
      usedFreeze = true
      // Streak sobrevive pero no suma
    } else {
      streak = 0 // racha rota
    }
  } else if (daysMissed > 1) {
    // Perdimos más de un día
    if (daysMissed === 2 && freezes > 0) {
      // Solo 1 día perdido (ayer) con freeze
      freezes--
      usedFreeze = true
    } else {
      streak = 0 // demasiados días perdidos
    }
  }

  // Verificar hoy
  const todayMet = dailyXP(logs, habits, todayStr) >= profile.dailyXPGoal
  if (todayMet && profile.streakDate !== todayStr) {
    streak++
  }

  // Recalcular freezes ganados
  const earnedFreezes = calculateEarnedFreezes(streak)
  freezes = Math.max(freezes, earnedFreezes)

  return {
    currentStreak: streak,
    streakDate: todayStr,
    streakFreezes: freezes,
    usedFreeze,
  }
}

// Racha de un hábito específico
export function habitStreak(logs: HabitLog[], habitId: string): number {
  let streak = 0
  let date = today()

  // Si hoy no está completado, empezar desde ayer
  const todayLog = logs.find(l => l.habitId === habitId && l.date === date && l.completed)
  if (!todayLog) {
    date = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  }

  while (true) {
    const log = logs.find(l => l.habitId === habitId && l.date === date && l.completed)
    if (!log) break
    streak++
    date = format(subDays(parseISO(date), 1), 'yyyy-MM-dd')
  }

  return streak
}

// Calcular streak freezes ganados por racha actual
export function calculateEarnedFreezes(currentStreak: number): number {
  return Math.min(
    Math.floor(currentStreak / GAME_CONFIG.streakFreeze.earnEveryDays),
    GAME_CONFIG.streakFreeze.maxFreezes
  )
}

// Liga semanal: determinar tier según XP de la semana
export function getWeeklyTier(weeklyXP: number): LeagueTier {
  const { thresholds } = GAME_CONFIG.league
  if (weeklyXP >= thresholds.diamante) return 'diamante'
  if (weeklyXP >= thresholds.platino) return 'platino'
  if (weeklyXP >= thresholds.oro) return 'oro'
  if (weeklyXP >= thresholds.plata) return 'plata'
  return 'bronce'
}

// XP de la semana actual
export function currentWeekXP(logs: HabitLog[], habits: Habit[], goalXP: number = 0): number {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Lunes
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  let xp = 0
  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd')
    xp += dailyXP(logs, habits, dateStr)
  }
  return xp + goalXP
}

// Mejor semana histórica
export function bestWeekXP(leagues: WeeklyLeague[]): number {
  if (leagues.length === 0) return 0
  return Math.max(...leagues.map(l => l.xp))
}

// Días perfectos consecutivos (para logro Semana Perfecta)
export function perfectDayStreak(logs: HabitLog[], habits: Habit[]): number {
  let streak = 0
  let date = today()

  if (!isPerfectDay(logs, habits, date)) {
    date = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  }

  while (true) {
    if (!isPerfectDay(logs, habits, date)) break
    streak++
    date = format(subDays(parseISO(date), 1), 'yyyy-MM-dd')
  }

  return streak
}

// Verificar si todos los hábitos se completaron antes de las 9am
export function checkEarlyBird(logs: HabitLog[], habits: Habit[], date: string): boolean {
  if (habits.length === 0) return false
  const activeHabits = habits.filter(h => h.createdAt <= date)
  if (activeHabits.length === 0) return false

  const now = new Date()
  if (format(now, 'yyyy-MM-dd') !== date) return false
  if (now.getHours() >= 9) return false

  return isPerfectDay(logs, habits, date)
}

// Generar datos para heatmap (últimos 365 días)
export function generateHeatmapData(
  logs: HabitLog[],
  _habits: Habit[]
): Array<{ date: string; count: number }> {
  const result: Array<{ date: string; count: number }> = []
  const now = new Date()

  for (let i = 364; i >= 0; i--) {
    const date = format(subDays(now, i), 'yyyy-MM-dd')
    const dayLogs = logs.filter(l => l.date === date && l.completed)
    result.push({ date, count: dayLogs.length })
  }

  return result
}

// Porcentaje de cumplimiento (últimos N días)
export function completionRate(logs: HabitLog[], habits: Habit[], days: number): number {
  const now = new Date()
  let totalPossible = 0
  let totalCompleted = 0

  for (let i = 0; i < days; i++) {
    const date = format(subDays(now, i), 'yyyy-MM-dd')
    const activeHabits = habits.filter(h => h.createdAt <= date)
    totalPossible += activeHabits.length
    totalCompleted += logs.filter(l => l.date === date && l.completed).length
  }

  if (totalPossible === 0) return 0
  return Math.round((totalCompleted / totalPossible) * 100)
}

// Obtener el inicio de la semana actual (lunes)
export function getWeekStart(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

// Verificar si necesitamos cerrar la semana (es un nuevo lunes)
export function shouldCloseWeek(leagues: WeeklyLeague[]): boolean {
  const currentWeekStart = getWeekStart()
  const lastLeague = leagues[leagues.length - 1]
  if (!lastLeague) return false

  const lastWeekStart = lastLeague.weekStart
  return lastWeekStart < currentWeekStart &&
    differenceInCalendarDays(parseISO(currentWeekStart), parseISO(lastWeekStart)) >= 7
}
