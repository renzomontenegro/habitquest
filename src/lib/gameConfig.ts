// Toda la config de gamificación centralizada y tunable

export const GAME_CONFIG = {
  // XP rewards
  xp: {
    binaryHabitComplete: 10,
    quantHabitComplete: 10,
    goalContribution: 10,
    perfectDayBonus: 20,
  },

  // Nivel: XP para subir de n → n+1
  levelXP: (level: number) => 100 + (level - 1) * 50,

  // Streak freezes
  streakFreeze: {
    earnEveryDays: 7,   // ganas 1 freeze cada 7 días de racha
    maxFreezes: 2,
  },

  // Liga semanal — umbrales de XP
  league: {
    tiers: ['bronce', 'plata', 'oro', 'platino', 'diamante'] as const,
    thresholds: {
      bronce: 0,
      plata: 50,
      oro: 150,
      platino: 300,
      diamante: 500,
    },
  },

  // Hitos de racha que disparan celebración
  streakMilestones: [7, 30, 100],

  // Hitos de meta que disparan celebración (%)
  goalMilestones: [25, 50, 75, 100],
} as const

// Categorías predefinidas para hábitos y metas
export const CATEGORIES = [
  { id: 'salud', name: 'Salud', icon: '❤️', color: '#FF4B4B' },
  { id: 'fitness', name: 'Fitness', icon: '🏋️', color: '#FF9600' },
  { id: 'finanzas', name: 'Finanzas', icon: '💰', color: '#58CC02' },
  { id: 'estudio', name: 'Estudio', icon: '📚', color: '#1CB0F6' },
  { id: 'trabajo', name: 'Trabajo', icon: '💼', color: '#CE82FF' },
  { id: 'bienestar', name: 'Bienestar', icon: '🧘', color: '#FFC800' },
  { id: 'social', name: 'Social', icon: '👥', color: '#FF6B9D' },
  { id: 'hogar', name: 'Hogar', icon: '🏠', color: '#4ECDC4' },
] as const

export type CategoryId = typeof CATEGORIES[number]['id']

export function getCategoryById(id: string) {
  return CATEGORIES.find(c => c.id === id)
}

// Nombres de liga en español
export const LEAGUE_NAMES: Record<string, string> = {
  bronce: 'Bronce',
  plata: 'Plata',
  oro: 'Oro',
  platino: 'Platino',
  diamante: 'Diamante',
}

// Colores de liga
export const LEAGUE_COLORS: Record<string, string> = {
  bronce: '#cd7f32',
  plata: '#c0c0c0',
  oro: '#ffd700',
  platino: '#e5e4e2',
  diamante: '#b9f2ff',
}
