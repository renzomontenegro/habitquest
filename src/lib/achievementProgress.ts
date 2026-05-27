import type { AppState } from '../types'
import { calculateGlobalStreak, perfectDayStreak } from './streaks'

// Calcula el progreso hacia cada logro no desbloqueado
// Retorna el más cercano a completarse
export interface AchievementProgress {
  id: string
  name: string
  icon: string
  description: string
  current: number
  target: number
  percent: number
}

export function getNextAchievement(state: AppState): AchievementProgress | null {
  const { habitLogs, habits, profile, goals, achievements } = state
  const { streak } = calculateGlobalStreak(habitLogs, habits, profile)
  const perfectStreak = perfectDayStreak(habitLogs, habits)

  const progressMap: Record<string, { current: number; target: number }> = {
    streak_7: { current: Math.min(streak, 7), target: 7 },
    streak_30: { current: Math.min(streak, 30), target: 30 },
    streak_100: { current: Math.min(streak, 100), target: 100 },
    perfect_day: { current: habits.length > 0 ? habitLogs.filter(l => l.date === new Date().toISOString().slice(0, 10) && l.completed).length : 0, target: Math.max(habits.length, 1) },
    perfect_week: { current: Math.min(perfectStreak, 7), target: 7 },
    first_goal_100: { current: goals.filter(g => g.currentAmount >= g.targetAmount).length, target: 1 },
    xp_1000: { current: Math.min(profile.totalXP, 1000), target: 1000 },
    level_10: { current: Math.min(profile.level, 10), target: 10 },
    // early_bird and comeback are event-based, hard to show progress
  }

  const locked = achievements.filter(a => !a.unlockedAt && progressMap[a.condition])

  if (locked.length === 0) return null

  // Find the one closest to completion
  let best: AchievementProgress | null = null
  let bestPercent = -1

  for (const a of locked) {
    const p = progressMap[a.condition]
    if (!p) continue
    const percent = p.target > 0 ? (p.current / p.target) * 100 : 0
    if (percent > bestPercent) {
      bestPercent = percent
      best = {
        id: a.id,
        name: a.name,
        icon: a.icon,
        description: a.description,
        current: p.current,
        target: p.target,
        percent: Math.min(percent, 99), // nunca 100 si está locked
      }
    }
  }

  return best
}

// Logros desbloqueados recientemente (últimos 7 días)
export function getRecentUnlocks(state: AppState) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return state.achievements
    .filter(a => a.unlockedAt && a.unlockedAt >= weekAgo)
    .sort((a, b) => (b.unlockedAt! > a.unlockedAt! ? 1 : -1))
}
