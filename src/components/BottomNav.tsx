import { motion } from 'framer-motion'

export type Tab = 'hoy' | 'metas' | 'stats' | 'ajustes'

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'hoy', label: 'Hoy', icon: '⚡' },
  { id: 'metas', label: 'Metas', icon: '🎯' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="app-tab-bar">
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full active:opacity-70 transition-opacity"
          >
            {isActive && (
              <motion.div
                layoutId="navPill"
                className="absolute -top-[1px] w-8 h-[3px] rounded-full bg-duo-green"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className={`text-[20px] leading-none ${isActive ? '' : 'opacity-50'}`}>
              {tab.icon}
            </span>
            <span className={`text-[10px] font-extrabold tracking-wide ${
              isActive ? 'text-duo-green' : 'text-[#5C7680]'
            }`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
