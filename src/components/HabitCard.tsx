import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Habit, HabitLog } from '../types'

interface HabitCardProps {
  habit: Habit
  log?: HabitLog
  onToggle: (id: string) => void
  onUpdateQuant: (id: string, value: number) => void
  onLongPress?: () => void
}

export function HabitCard({ habit, log, onToggle, onUpdateQuant, onLongPress }: HabitCardProps) {
  const completed = log?.completed ?? false
  const [showXP, setShowXP] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerXP = () => {
    setShowXP(true)
    setTimeout(() => setShowXP(false), 700)
  }

  // Long press detection
  const handleTouchStart = () => {
    if (!onLongPress) return
    timerRef.current = setTimeout(onLongPress, 500)
  }
  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  if (habit.type === 'binary') {
    return (
      <div className="relative">
        <AnimatePresence>
          {showXP && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -40 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute -top-1 right-4 z-10 font-black text-duo-yellow text-[15px] pointer-events-none"
            >
              +{habit.xpReward} XP
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            if (!completed) triggerXP()
            onToggle(habit.id)
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-colors ${
            completed
              ? 'bg-[rgba(88,204,2,0.08)] border-duo-green shadow-[0_2px_0_#43C000]'
              : 'bg-surface-800 border-surface-600 shadow-[0_2px_0_var(--color-surface-700)]'
          } active:translate-y-[2px] active:shadow-none`}
        >
          <span className="text-2xl flex-shrink-0">{habit.icon}</span>
          <span className={`flex-1 text-left font-extrabold text-[15px] ${completed ? 'text-duo-green' : 'text-white'}`}>
            {habit.name}
          </span>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-colors ${
            completed
              ? 'bg-duo-green border-duo-green-dark'
              : 'bg-surface-700 border-surface-500'
          }`}>
            {completed && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.15 }}
                className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </motion.svg>
            )}
          </div>
        </button>
      </div>
    )
  }

  // === Quant habit ===
  const currentValue = typeof log?.value === 'number' ? log.value : 0
  const target = habit.target ?? 0
  const progress = target > 0 ? Math.min(currentValue / target, 1) : 0
  const step = target >= 1000 ? 500 : target >= 100 ? 100 : target >= 10 ? 1 : 0.5

  return (
    <div className="relative">
      <AnimatePresence>
        {showXP && (
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -40 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute -top-1 right-4 z-10 font-black text-duo-yellow text-[15px] pointer-events-none"
          >
            +{habit.xpReward} XP
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`w-full p-3 rounded-2xl border-2 transition-colors ${
          completed
            ? 'bg-[rgba(88,204,2,0.08)] border-duo-green shadow-[0_2px_0_#43C000]'
            : 'bg-surface-800 border-surface-600 shadow-[0_2px_0_var(--color-surface-700)]'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className="flex items-center gap-3 mb-2.5">
          <span className="text-2xl">{habit.icon}</span>
          <div className="flex-1 min-w-0">
            <span className={`font-extrabold text-[15px] ${completed ? 'text-duo-green' : 'text-white'}`}>
              {habit.name}
            </span>
            <div className="text-[12px] font-bold text-[#5C7680]">
              {currentValue} / {target} {habit.unit}
            </div>
          </div>
          {completed && (
            <div className="w-9 h-9 rounded-lg bg-duo-green border-2 border-duo-green-dark flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="progress-bar-track !h-2.5 mb-3">
          <motion.div
            className={`progress-bar-fill ${completed
              ? 'bg-gradient-to-r from-duo-green to-duo-green-light'
              : 'bg-gradient-to-r from-duo-yellow to-duo-orange'
            }`}
            animate={{ width: `${Math.max(progress * 100, 1)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2.5">
          <button
            onClick={() => onUpdateQuant(habit.id, Math.max(0, currentValue - step))}
            className="w-11 h-11 rounded-xl bg-surface-700 border-2 border-surface-500 shadow-[0_3px_0_var(--color-surface-600)] text-white text-xl font-black flex items-center justify-center active:shadow-none active:translate-y-[3px] transition-all duration-100"
          >
            -
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={currentValue}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0
              const was = completed
              onUpdateQuant(habit.id, Math.max(0, v))
              if (!was && v >= target) triggerXP()
            }}
            className="w-20 h-11 text-center text-[17px] font-black bg-surface-700 text-white rounded-xl border-2 border-surface-500 outline-none focus:border-duo-blue"
          />
          <button
            onClick={() => {
              const newVal = currentValue + step
              const was = completed
              onUpdateQuant(habit.id, newVal)
              if (!was && newVal >= target) triggerXP()
            }}
            className="w-11 h-11 rounded-xl bg-duo-green border-2 border-duo-green-dark shadow-[0_3px_0_#43C000] text-white text-xl font-black flex items-center justify-center active:shadow-none active:translate-y-[3px] transition-all duration-100"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
