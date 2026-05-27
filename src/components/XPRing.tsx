import { motion } from 'framer-motion'

interface XPRingProps {
  current: number
  target: number
  size?: number
  strokeWidth?: number
}

export function XPRing({ current, target, size = 160, strokeWidth = 14 }: XPRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(current / target, 1)
  const offset = circumference * (1 - progress)
  const isComplete = progress >= 1

  const strokeColor = isComplete ? '#58CC02' : '#FFC800'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#233742" strokeWidth={strokeWidth} strokeLinecap="round"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: [0.3, 0.7, 0.4, 1] }}
          style={{ filter: isComplete ? `drop-shadow(0 0 6px ${strokeColor})` : 'none' }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute flex flex-col items-center">
        <span className="font-black text-white" style={{ fontSize: size * 0.19 }}>
          {current}
        </span>
        <span className="font-bold text-[#5C7680]" style={{ fontSize: size * 0.08 }}>
          / {target} XP
        </span>
        {isComplete && (
          <span className="text-duo-green font-extrabold text-[11px] mt-0.5 uppercase tracking-wider">
            Completado
          </span>
        )}
      </div>
    </div>
  )
}
