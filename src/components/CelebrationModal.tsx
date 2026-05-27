import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useEffect } from 'react'

interface CelebrationModalProps {
  celebration: { type: string; message: string } | null
  onClose: () => void
}

const DUO_CONFETTI_COLORS = ['#58CC02', '#FFC800', '#1CB0F6', '#CE82FF', '#FF9600']

export function CelebrationModal({ celebration, onClose }: CelebrationModalProps) {
  // Fire confetti bursts from both sides on mount
  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { x: 0.1, y: 0.6 },
        colors: DUO_CONFETTI_COLORS,
        disableForReducedMotion: true,
      })
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { x: 0.9, y: 0.6 },
        colors: DUO_CONFETTI_COLORS,
        disableForReducedMotion: true,
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [celebration])

  const config: Record<string, { icon: string; title: string; bg: string; shadow: string }> = {
    levelup: {
      icon: '🎉',
      title: 'Level Up!',
      bg: 'from-duo-purple to-[#E8A0FF]',
      shadow: '0 8px 0 #A560E8',
    },
    milestone: {
      icon: '🏆',
      title: 'Hito Alcanzado!',
      bg: 'from-duo-yellow to-duo-orange',
      shadow: '0 8px 0 #E58700',
    },
    achievement: {
      icon: '🌟',
      title: 'Nuevo Logro!',
      bg: 'from-duo-green to-[#7AE82B]',
      shadow: '0 8px 0 #43C000',
    },
    streak: {
      icon: '🔥',
      title: 'Racha Épica!',
      bg: 'from-duo-orange to-duo-red',
      shadow: '0 8px 0 #E53838',
    },
  }

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 30 }}
            transition={{ duration: 0.5, ease: [0.3, 0.7, 0.4, 1.5] }}
            className={`bg-gradient-to-br ${config[celebration.type]?.bg ?? config.achievement.bg} rounded-3xl p-8 mx-6 text-center max-w-xs w-full`}
            style={{ boxShadow: config[celebration.type]?.shadow ?? config.achievement.shadow }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated icon */}
            <motion.div
              animate={{
                scale: [1, 1.4, 1],
                rotate: [0, -15, 15, -10, 10, 0],
              }}
              transition={{ duration: 0.8, ease: 'easeOut', repeat: 1 }}
              className="text-7xl mb-4"
            >
              {config[celebration.type]?.icon ?? '✨'}
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-2xl font-black text-white mb-2 uppercase tracking-wide"
            >
              {config[celebration.type]?.title ?? 'Genial!'}
            </motion.h2>

            {/* Message */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-white/90 text-lg font-bold mb-6"
            >
              {celebration.message}
            </motion.p>

            {/* Button */}
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              whileTap={{ scale: 0.95, y: 4 }}
              onClick={onClose}
              className="w-full h-14 bg-white/20 border-2 border-white/30 rounded-2xl text-white font-black text-lg uppercase tracking-wide shadow-[0_4px_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-1 transition-all duration-100"
            >
              Genial!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
