import { motion } from 'framer-motion'
import { calculateLevel } from '../lib/xp'

interface LevelBarProps {
  totalXP: number
}

export function LevelBar({ totalXP }: LevelBarProps) {
  const { level, xpInLevel, xpNeeded } = calculateLevel(totalXP)
  const progress = xpInLevel / xpNeeded

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-duo-purple flex items-center justify-center text-xs font-black text-white shadow-[0_3px_0_#A560E8]">
            {level}
          </div>
          <span className="font-extrabold text-sm text-[#94A7B0]">Nivel {level}</span>
        </div>
        <span className="text-xs font-bold text-[#5C7680]">{xpInLevel} / {xpNeeded} XP</span>
      </div>
      <div className="progress-bar-track">
        <motion.div
          className="progress-bar-fill bg-gradient-to-r from-duo-purple to-[#E8A0FF]"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(progress * 100, 2)}%` }}
          transition={{ duration: 0.8, ease: [0.3, 0.7, 0.4, 1] }}
        />
      </div>
    </div>
  )
}
