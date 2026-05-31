import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BottomNav, type Tab } from './components/BottomNav'
import { CelebrationModal } from './components/CelebrationModal'
import { TodayScreen } from './screens/TodayScreen'
import { GoalsScreen } from './screens/GoalsScreen'
import { StatsScreen } from './screens/StatsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { useAppState } from './hooks/useAppState'

export default function App() {
  const [tab, setTab] = useState<Tab>('hoy')
  const app = useAppState()

  const handleTabChange = useCallback((newTab: Tab) => {
    if (newTab === tab && newTab === 'hoy') {
      app.refreshFromCloud()
    }
    setTab(newTab)
  }, [tab, app.refreshFromCloud])

  return (
    <div className="app-shell">
      <div className="app-header-safe" />

      <main className="app-content">
        <AnimatePresence>
          {app.refreshing && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex items-center justify-center gap-2 py-2 text-[12px] font-bold text-duo-green"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="inline-block"
              >
                ~
              </motion.span>
              Sincronizando...
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
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
            {tab === 'ajustes' && (
              <SettingsScreen
                state={app.state}
                syncEnabled={app.syncEnabled}
                syncError={app.syncError}
                onUpdateSettings={app.updateSettings}
                onUpdateDailyGoal={app.updateDailyGoal}
                onReset={app.resetState}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav active={tab} onChange={handleTabChange} />
      <CelebrationModal celebration={app.celebration} onClose={() => app.setCelebration(null)} />
    </div>
  )
}
