import { useState, useCallback, useEffect } from 'react'
import type { AppState, Habit, HabitLog, Goal, GoalContribution, DailyXPGoal } from '../types'
import { storage } from '../lib/storage'
import { addXP } from '../lib/xp'
import { GAME_CONFIG } from '../lib/gameConfig'
import { today, updateStreak, isPerfectDay, checkEarlyBird, perfectDayStreak, currentWeekXP, getWeeklyTier, getWeekStart } from '../lib/streaks'
import { playComplete, playLevelUp, playAchievement } from '../lib/sounds'
import confetti from 'canvas-confetti'

const DUO_COLORS = ['#58CC02', '#FFC800', '#1CB0F6', '#CE82FF', '#FF9600']

export function useAppState() {
  const [state, setState] = useState<AppState>(() => storage.load())
  const [celebration, setCelebration] = useState<{ type: string; message: string } | null>(null)

  // Persistir en cada cambio
  useEffect(() => {
    storage.save(state)
  }, [state])

  const genId = () => crypto.randomUUID()

  // Al abrir la app: actualizar racha (detectar días perdidos)
  useEffect(() => {
    setState(prev => {
      const streakUpdate = updateStreak(prev.habitLogs, prev.habits, prev.profile)
      if (
        streakUpdate.currentStreak === prev.profile.currentStreak &&
        streakUpdate.streakDate === prev.profile.streakDate
      ) return prev // sin cambios
      return {
        ...prev,
        profile: {
          ...prev.profile,
          currentStreak: streakUpdate.currentStreak,
          streakDate: streakUpdate.streakDate,
          streakFreezes: streakUpdate.streakFreezes,
        },
      }
    })
  }, []) // solo al montar

  const celebrate = useCallback((type: string, message: string) => {
    setCelebration({ type, message })
    confetti({
      particleCount: 60,
      spread: 55,
      origin: { y: 0.6 },
      colors: DUO_COLORS,
      disableForReducedMotion: true,
    })
    setTimeout(() => setCelebration(null), 3500)
  }, [])

  // --- Verificar logros ---
  const checkAchievements = useCallback((newState: AppState): AppState => {
    const { habitLogs, habits, profile, goals, achievements } = newState
    const todayStr = today()
    const streak = profile.currentStreak
    const updated = [...achievements]
    let changed = false

    const unlock = (id: string) => {
      const a = updated.find(x => x.id === id)
      if (a && !a.unlockedAt) {
        a.unlockedAt = new Date().toISOString()
        changed = true
        setTimeout(() => {
          if (newState.settings.soundEnabled) playAchievement()
          celebrate('achievement', `${a.name} ${a.icon}`)
        }, 500)
      }
    }

    if (streak >= 7) unlock('streak_7')
    if (streak >= 30) unlock('streak_30')
    if (streak >= 100) unlock('streak_100')
    if (isPerfectDay(habitLogs, habits, todayStr)) unlock('perfect_day')
    if (perfectDayStreak(habitLogs, habits) >= 7) unlock('perfect_week')
    if (goals.some(g => g.currentAmount >= g.targetAmount)) unlock('first_goal_100')
    if (profile.totalXP >= 1000) unlock('xp_1000')
    if (profile.level >= 10) unlock('level_10')
    if (checkEarlyBird(habitLogs, habits, todayStr)) unlock('early_bird')

    return changed ? { ...newState, achievements: updated } : newState
  }, [celebrate])

  // --- Hábitos ---
  const toggleHabit = useCallback((habitId: string) => {
    setState(prev => {
      const todayStr = today()
      const habit = prev.habits.find(h => h.id === habitId)
      if (!habit || habit.type !== 'binary') return prev

      const existingLog = prev.habitLogs.find(l => l.habitId === habitId && l.date === todayStr)
      let newLogs: HabitLog[]
      let xpDelta = 0

      if (existingLog) {
        if (existingLog.completed) {
          newLogs = prev.habitLogs.map(l =>
            l.id === existingLog.id ? { ...l, value: false, completed: false } : l
          )
          xpDelta = -habit.xpReward
          if (isPerfectDay(prev.habitLogs, prev.habits, todayStr)) {
            xpDelta -= GAME_CONFIG.xp.perfectDayBonus
          }
        } else {
          newLogs = prev.habitLogs.map(l =>
            l.id === existingLog.id ? { ...l, value: true, completed: true } : l
          )
          xpDelta = habit.xpReward
        }
      } else {
        newLogs = [...prev.habitLogs, {
          id: genId(), habitId, date: todayStr, value: true, completed: true,
        }]
        xpDelta = habit.xpReward
      }

      if (xpDelta > 0 && isPerfectDay(newLogs, prev.habits, todayStr)) {
        xpDelta += GAME_CONFIG.xp.perfectDayBonus
      }

      const { profile, leveledUp, newLevel } = addXP(prev.profile, xpDelta)

      if (xpDelta > 0) {
        if (prev.settings.soundEnabled) playComplete()
        confetti({ particleCount: 25, spread: 45, origin: { y: 0.7 }, colors: DUO_COLORS, disableForReducedMotion: true })
      }
      if (leveledUp) {
        setTimeout(() => {
          if (prev.settings.soundEnabled) playLevelUp()
          celebrate('levelup', `Subiste al nivel ${newLevel}!`)
        }, 300)
      }

      // Actualizar racha hacia adelante
      const streakUpdate = updateStreak(newLogs, prev.habits, profile)

      const newState: AppState = {
        ...prev,
        habitLogs: newLogs,
        profile: {
          ...profile,
          lastActiveDate: todayStr,
          currentStreak: streakUpdate.currentStreak,
          streakDate: streakUpdate.streakDate,
          streakFreezes: streakUpdate.streakFreezes,
        },
      }
      return checkAchievements(newState)
    })
  }, [celebrate, checkAchievements])

  const updateQuantHabit = useCallback((habitId: string, value: number) => {
    setState(prev => {
      const todayStr = today()
      const habit = prev.habits.find(h => h.id === habitId)
      if (!habit || habit.type !== 'quant') return prev

      const existingLog = prev.habitLogs.find(l => l.habitId === habitId && l.date === todayStr)
      const wasCompleted = existingLog?.completed ?? false
      const isNowCompleted = value >= (habit.target ?? 0)

      let newLogs: HabitLog[]
      if (existingLog) {
        newLogs = prev.habitLogs.map(l =>
          l.id === existingLog.id ? { ...l, value, completed: isNowCompleted } : l
        )
      } else {
        newLogs = [...prev.habitLogs, {
          id: genId(), habitId, date: todayStr, value, completed: isNowCompleted,
        }]
      }

      let xpDelta = 0
      if (isNowCompleted && !wasCompleted) {
        xpDelta = habit.xpReward
        if (isPerfectDay(newLogs, prev.habits, todayStr)) {
          xpDelta += GAME_CONFIG.xp.perfectDayBonus
        }
        if (prev.settings.soundEnabled) playComplete()
        confetti({ particleCount: 25, spread: 45, origin: { y: 0.7 }, colors: DUO_COLORS, disableForReducedMotion: true })
      } else if (!isNowCompleted && wasCompleted) {
        xpDelta = -habit.xpReward
        if (isPerfectDay(prev.habitLogs, prev.habits, todayStr)) {
          xpDelta -= GAME_CONFIG.xp.perfectDayBonus
        }
      }

      const { profile, leveledUp, newLevel } = addXP(prev.profile, xpDelta)
      if (leveledUp) {
        setTimeout(() => {
          if (prev.settings.soundEnabled) playLevelUp()
          celebrate('levelup', `Subiste al nivel ${newLevel}!`)
        }, 300)
      }

      const streakUpdate = updateStreak(newLogs, prev.habits, profile)

      const newState: AppState = {
        ...prev,
        habitLogs: newLogs,
        profile: {
          ...profile,
          lastActiveDate: todayStr,
          currentStreak: streakUpdate.currentStreak,
          streakDate: streakUpdate.streakDate,
          streakFreezes: streakUpdate.streakFreezes,
        },
      }
      return checkAchievements(newState)
    })
  }, [celebrate, checkAchievements])

  // --- Metas ---
  const addGoalContribution = useCallback((goalId: string, amount: number, note?: string) => {
    setState(prev => {
      const goal = prev.goals.find(g => g.id === goalId)
      if (!goal) return prev

      const newAmount = goal.currentAmount + amount
      const prevPercent = Math.floor((goal.currentAmount / goal.targetAmount) * 100)
      const newPercent = Math.floor((newAmount / goal.targetAmount) * 100)

      const contribution: GoalContribution = {
        id: genId(), goalId, date: today(), amount, note,
      }

      const { profile, leveledUp, newLevel } = addXP(prev.profile, GAME_CONFIG.xp.goalContribution)

      if (prev.settings.soundEnabled) playComplete()
      confetti({ particleCount: 20, spread: 40, origin: { y: 0.7 }, colors: DUO_COLORS, disableForReducedMotion: true })

      for (const milestone of GAME_CONFIG.goalMilestones) {
        if (prevPercent < milestone && newPercent >= milestone) {
          setTimeout(() => celebrate('milestone', `"${goal.name}" al ${milestone}%!`), 300)
          break
        }
      }

      if (leveledUp) {
        setTimeout(() => {
          if (prev.settings.soundEnabled) playLevelUp()
          celebrate('levelup', `Subiste al nivel ${newLevel}!`)
        }, 600)
      }

      const newState: AppState = {
        ...prev,
        goals: prev.goals.map(g => g.id === goalId ? { ...g, currentAmount: newAmount } : g),
        goalContributions: [...prev.goalContributions, contribution],
        profile: { ...profile, lastActiveDate: today() },
      }
      return checkAchievements(newState)
    })
  }, [celebrate, checkAchievements])

  // --- CRUD ---
  const addHabit = useCallback((habit: Omit<Habit, 'id' | 'createdAt'>) => {
    setState(prev => ({
      ...prev,
      habits: [...prev.habits, { ...habit, id: genId(), createdAt: today() }],
    }))
  }, [])

  const updateHabit = useCallback((id: string, data: Partial<Habit>) => {
    setState(prev => ({
      ...prev,
      habits: prev.habits.map(h => h.id === id ? { ...h, ...data } : h),
    }))
  }, [])

  const deleteHabit = useCallback((id: string) => {
    // Los logs se conservan como huérfanos para preservar el historial de XP/racha
    setState(prev => ({
      ...prev,
      habits: prev.habits.filter(h => h.id !== id),
    }))
  }, [])

  const addGoal = useCallback((goal: Omit<Goal, 'id' | 'currentAmount'>) => {
    setState(prev => ({
      ...prev,
      goals: [...prev.goals, { ...goal, id: genId(), currentAmount: 0 }],
    }))
  }, [])

  const updateGoal = useCallback((id: string, data: Partial<Goal>) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.map(g => g.id === id ? { ...g, ...data } : g),
    }))
  }, [])

  const deleteGoal = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== id),
      goalContributions: prev.goalContributions.filter(c => c.goalId !== id),
    }))
  }, [])

  // --- Settings ---
  const updateSettings = useCallback((settings: Partial<AppState['settings']>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }))
  }, [])

  const updateDailyGoal = useCallback((goal: DailyXPGoal) => {
    setState(prev => ({
      ...prev,
      profile: { ...prev.profile, dailyXPGoal: goal },
    }))
  }, [])

  // --- Liga semanal ---
  const updateWeeklyLeague = useCallback(() => {
    setState(prev => {
      const weekStart = getWeekStart()
      const weekXP = currentWeekXP(prev.habitLogs, prev.habits)
      const tier = getWeeklyTier(weekXP)

      const existingIdx = prev.weeklyLeagues.findIndex(l => l.weekStart === weekStart)
      let leagues = [...prev.weeklyLeagues]

      if (existingIdx >= 0) {
        leagues[existingIdx] = { weekStart, xp: weekXP, tier }
      } else {
        leagues.push({ weekStart, xp: weekXP, tier })
      }

      if (leagues.length > 52) leagues = leagues.slice(-52)
      return { ...prev, weeklyLeagues: leagues }
    })
  }, [])

  useEffect(() => {
    updateWeeklyLeague()
  }, [updateWeeklyLeague])

  // --- Import/Export ---
  const importState = useCallback((json: string): boolean => {
    const imported = storage.importJSON(json)
    if (imported) {
      setState(imported)
      return true
    }
    return false
  }, [])

  const exportState = useCallback((): string => {
    return storage.exportJSON(state)
  }, [state])

  const resetState = useCallback(() => {
    storage.save(storage.load()) // triggers default state creation
    // Reload from scratch
    localStorage.removeItem('habitquest_state')
    window.location.reload()
  }, [])

  return {
    state,
    celebration,
    setCelebration,
    toggleHabit,
    updateQuantHabit,
    addGoalContribution,
    addHabit,
    updateHabit,
    deleteHabit,
    addGoal,
    updateGoal,
    deleteGoal,
    updateSettings,
    updateDailyGoal,
    importState,
    exportState,
    resetState,
  }
}
