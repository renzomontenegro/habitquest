// --- Hábitos ---
export type HabitType = 'binary' | 'quant' | 'cycle'

export interface Habit {
  id: string
  name: string
  icon: string
  type: HabitType
  target?: number
  unit?: string
  xpReward: number
  color: string
  createdAt: string
  category?: string
  cycleSteps?: string[]       // pasos del ciclo, ej: ["Upper", "Lower", "Descanso", "Push", "Pull", "Legs", "Descanso"]
  cycleStartIndex?: number   // desde qué paso empezar (default 0)
}

export interface HabitLog {
  id: string
  habitId: string
  date: string       // YYYY-MM-DD
  value: number | boolean
  completed: boolean
}

// --- Metas ---
export interface Goal {
  id: string
  name: string
  icon: string
  targetAmount: number
  currentAmount: number
  unit: string
  deadline?: string
  category?: string
}

export interface GoalContribution {
  id: string
  goalId: string
  date: string
  amount: number
  note?: string
}

// --- Perfil ---
export type DailyXPGoal = 10 | 20 | 30 | 50

export interface UserProfile {
  totalXP: number
  level: number
  dailyXPGoal: DailyXPGoal
  streakFreezes: number
  lastActiveDate: string
  // Racha almacenada — se actualiza hacia adelante, nunca se recalcula retroactivamente
  currentStreak: number
  streakDate: string // último día que contó para la racha (YYYY-MM-DD)
}

// --- Logros ---
export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  condition: string
  unlockedAt?: string
}

// --- Liga ---
export type LeagueTier = 'bronce' | 'plata' | 'oro' | 'platino' | 'diamante'

export interface WeeklyLeague {
  weekStart: string
  xp: number
  tier: LeagueTier
}

// --- Settings ---
export interface AppSettings {
  soundEnabled: boolean
}

// --- Estado global ---
export interface AppState {
  profile: UserProfile
  habits: Habit[]
  habitLogs: HabitLog[]
  goals: Goal[]
  goalContributions: GoalContribution[]
  achievements: Achievement[]
  weeklyLeagues: WeeklyLeague[]
  settings: AppSettings
}
