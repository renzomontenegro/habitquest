import { motion } from 'framer-motion'

export type Tab = 'hoy' | 'metas' | 'stats' | 'logros' | 'ajustes'

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: string; activeIcon: string }[] = [
  { id: 'hoy', label: 'Hoy', icon: '⚡', activeIcon: '⚡' },
  { id: 'metas', label: 'Metas', icon: '🎯', activeIcon: '🎯' },
  { id: 'stats', label: 'Stats', icon: '📊', activeIcon: '📊' },
  { id: 'logros', label: 'Logros', icon: '🏅', activeIcon: '🏅' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️', activeIcon: '⚙️' },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface-900/98 backdrop-blur-xl border-t-2 border-surface-600"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-around items-center h-[64px] max-w-lg mx-auto">
        {tabs.map(tab => {
          const isActive = active === tab.id
          return (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.85 }}
              onClick={() => onChange(tab.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full"
            >
              {/* Active indicator pill */}
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute -top-[1px] w-10 h-[3px] rounded-full bg-duo-green"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              <motion.span
                className="text-[22px] leading-none"
                animate={{
                  scale: isActive ? 1.15 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              >
                {isActive ? tab.activeIcon : tab.icon}
              </motion.span>
              <span className={`text-[10px] font-extrabold tracking-wide ${
                isActive ? 'text-duo-green' : 'text-[#5C7680]'
              }`}>
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
