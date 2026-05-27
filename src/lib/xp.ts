import { GAME_CONFIG } from './gameConfig'
import type { UserProfile } from '../types'

// XP necesario para subir del nivel actual al siguiente
export function xpForNextLevel(level: number): number {
  return GAME_CONFIG.levelXP(level)
}

// XP acumulado necesario para alcanzar un nivel dado (desde nivel 1)
export function totalXPForLevel(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) {
    total += GAME_CONFIG.levelXP(i)
  }
  return total
}

// Calcula nivel y XP sobrante para un total de XP dado
export function calculateLevel(totalXP: number): { level: number; xpInLevel: number; xpNeeded: number } {
  let level = 1
  let remaining = totalXP

  while (remaining >= GAME_CONFIG.levelXP(level)) {
    remaining -= GAME_CONFIG.levelXP(level)
    level++
  }

  return {
    level,
    xpInLevel: remaining,
    xpNeeded: GAME_CONFIG.levelXP(level),
  }
}

// Añade XP y recalcula nivel, retorna si subió de nivel
export function addXP(
  profile: UserProfile,
  amount: number
): { profile: UserProfile; leveledUp: boolean; newLevel: number } {
  const newTotalXP = profile.totalXP + amount
  const { level } = calculateLevel(newTotalXP)
  const leveledUp = level > profile.level

  return {
    profile: { ...profile, totalXP: newTotalXP, level },
    leveledUp,
    newLevel: level,
  }
}
