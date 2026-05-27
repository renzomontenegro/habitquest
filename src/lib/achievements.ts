import type { Achievement } from '../types'

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'streak_7',
    name: 'En Racha',
    description: '7 días consecutivos de racha',
    icon: '🔥',
    condition: 'streak_7',
  },
  {
    id: 'streak_30',
    name: 'Imparable',
    description: '30 días consecutivos de racha',
    icon: '💪',
    condition: 'streak_30',
  },
  {
    id: 'streak_100',
    name: 'Leyenda',
    description: '100 días consecutivos de racha',
    icon: '👑',
    condition: 'streak_100',
  },
  {
    id: 'perfect_day',
    name: 'Día Perfecto',
    description: 'Completa todos los hábitos en un día',
    icon: '⭐',
    condition: 'perfect_day',
  },
  {
    id: 'perfect_week',
    name: 'Semana Perfecta',
    description: '7 días perfectos consecutivos',
    icon: '🌟',
    condition: 'perfect_week',
  },
  {
    id: 'first_goal_100',
    name: 'Meta Cumplida',
    description: 'Completa tu primera meta al 100%',
    icon: '🎯',
    condition: 'first_goal_100',
  },
  {
    id: 'xp_1000',
    name: 'Mil XP',
    description: 'Acumula 1000 XP totales',
    icon: '💎',
    condition: 'xp_1000',
  },
  {
    id: 'level_10',
    name: 'Nivel 10',
    description: 'Alcanza el nivel 10',
    icon: '🏆',
    condition: 'level_10',
  },
  {
    id: 'early_bird',
    name: 'Madrugador',
    description: 'Completa todos los hábitos antes de las 9am',
    icon: '🌅',
    condition: 'early_bird',
  },
  {
    id: 'comeback',
    name: 'Comeback',
    description: 'Recupera tu racha usando un streak freeze',
    icon: '🧊',
    condition: 'comeback',
  },
]
