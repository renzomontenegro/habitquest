import { motion } from 'framer-motion'
import type { AppState } from '../types'

interface AchievementsScreenProps {
  state: AppState
}

export function AchievementsScreen({ state }: AchievementsScreenProps) {
  const unlocked = state.achievements.filter(a => a.unlockedAt).length
  const total = state.achievements.length

  return (
    <div className="px-4 pt-2 pb-8 space-y-4">
      <div>
        <h1 className="text-xl font-black text-white leading-tight mb-1">Logros</h1>
        <p className="text-[13px] font-bold text-[#5C7680]">
          {unlocked} de {total} desbloqueados. Completa habitos y metas para desbloquear mas.
        </p>
      </div>

      {/* Progress */}
      <div className="progress-bar-track !h-3">
        <motion.div
          className="progress-bar-fill bg-gradient-to-r from-duo-yellow to-duo-orange"
          animate={{ width: `${Math.max((unlocked / total) * 100, 2)}%` }}
          transition={{ duration: 0.6, ease: [0.3, 0.7, 0.4, 1] }}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {state.achievements.map(achievement => {
          const isUnlocked = !!achievement.unlockedAt
          return (
            <div
              key={achievement.id}
              className={`card-3d text-center !py-4 !px-3 ${
                isUnlocked
                  ? '!border-duo-yellow !shadow-[0_2px_0_#E58700]'
                  : 'opacity-45'
              }`}
            >
              <div className={`text-4xl mb-2 ${isUnlocked ? '' : 'grayscale'}`}>
                {achievement.icon}
              </div>
              <div className={`text-[13px] font-black mb-0.5 ${isUnlocked ? 'text-white' : 'text-[#5C7680]'}`}>
                {achievement.name}
              </div>
              <div className={`text-[11px] font-bold leading-snug ${isUnlocked ? 'text-[#94A7B0]' : 'text-[#3C5564]'}`}>
                {achievement.description}
              </div>
              {isUnlocked && (
                <div className="mt-1.5 text-[10px] font-bold text-duo-yellow">
                  {new Date(achievement.unlockedAt!).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                </div>
              )}
              {!isUnlocked && <div className="mt-1.5 text-sm">🔒</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
