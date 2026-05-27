import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BottomNav, type Tab } from './components/BottomNav'
import { CelebrationModal } from './components/CelebrationModal'
import { TodayScreen } from './screens/TodayScreen'
import { GoalsScreen } from './screens/GoalsScreen'
import { StatsScreen } from './screens/StatsScreen'
import { AchievementsScreen } from './screens/AchievementsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { useAppState } from './hooks/useAppState'

export default function App() {
  const [tab, setTab] = useState<Tab>('hoy')
  const app = useAppState()

  return (
    <div className="min-h-dvh bg-surface-900 text-white max-w-lg mx-auto relative">
      <div style={{ paddingTop: 'env(safe-area-inset-top)' }} />

      <main className="pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {tab === 'hoy' && (
              <TodayScreen
                state={app.state}
                onToggle={app.toggleHabit}
                onUpdateQuant={app.updateQuantHabit}
                onAddHabit={app.addHabit}
                onUpdateHabit={app.updateHabit}
                onDeleteHabit={app.deleteHabit}
              />
            )}
            {tab === 'metas' && (
              <GoalsScreen
                state={app.state}
                onAddContribution={app.addGoalContribution}
                onAddGoal={app.addGoal}
                onUpdateGoal={app.updateGoal}
                onDeleteGoal={app.deleteGoal}
              />
            )}
            {tab === 'stats' && <StatsScreen state={app.state} />}
            {tab === 'logros' && <AchievementsScreen state={app.state} />}
            {tab === 'ajustes' && (
              <SettingsScreen
                state={app.state}
                onUpdateSettings={app.updateSettings}
                onUpdateDailyGoal={app.updateDailyGoal}
                onExport={app.exportState}
                onImport={app.importState}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav active={tab} onChange={setTab} />
      <CelebrationModal celebration={app.celebration} onClose={() => app.setCelebration(null)} />
    </div>
  )
}
