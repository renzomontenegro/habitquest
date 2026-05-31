import { useState, useCallback, useRef } from 'react'
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

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const pulling = useRef(false)
  const threshold = 80

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = (e.currentTarget as HTMLElement).scrollTop
    if (scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY
      pulling.current = true
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setPullDistance(Math.min(dy * 0.5, 120))
    else pulling.current = false
  }, [])

  const onTouchEnd = useCallback(() => {
    if (pulling.current && pullDistance >= threshold && !app.refreshing) {
      app.refreshFromCloud()
    }
    pulling.current = false
    setPullDistance(0)
  }, [pullDistance, app.refreshing, app.refreshFromCloud])

  return (
    <div className="app-shell">
      <div className="app-header-safe" />

      <main
        className="app-content"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
          style={{ height: app.refreshing ? 36 : pullDistance > 10 ? pullDistance : 0 }}
        >
          {app.refreshing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-[12px] font-bold text-duo-green"
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
          ) : pullDistance > 10 && (
            <span
              className="text-[12px] font-bold transition-colors"
              style={{ color: pullDistance >= threshold ? '#58CC02' : '#5C7680' }}
            >
              {pullDistance >= threshold ? 'Soltar para sincronizar' : 'Tirar para sincronizar'}
            </span>
          )}
        </div>
        {/* Sync error alert */}
        <AnimatePresence>
          {app.syncError && !app.refreshing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-4 mb-2 px-3 py-2.5 rounded-xl bg-red-900/30 border border-red-500/30 flex items-center gap-2"
            >
              <span className="text-[16px]">&#x26A0;</span>
              <p className="text-[12px] font-bold text-red-400">{app.syncError}</p>
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
            className={app.syncError ? 'pointer-events-none opacity-40' : ''}
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
                refreshing={app.refreshing}
                onUpdateSettings={app.updateSettings}
                onUpdateDailyGoal={app.updateDailyGoal}
                onRefresh={app.refreshFromCloud}
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
