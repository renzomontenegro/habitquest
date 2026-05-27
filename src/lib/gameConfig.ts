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
