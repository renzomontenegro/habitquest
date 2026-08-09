import { useState, useCallback, useRef } from 'react'
import { TodayScreen } from './screens/TodayScreen'
import { WeekScreen } from './screens/WeekScreen'
import { PlanScreen } from './screens/PlanScreen'
import { SettingsSheet } from './screens/SettingsSheet'
import { SetupScreen } from './screens/SetupScreen'
import { useAppState } from './hooks/useAppState'
import { headerDate, isoWeek, parseDate, weightAvg, addDays } from './lib/logic'
import { SaveDot } from './components/ui'

type Tab = 'hoy' | 'semana' | 'plan'

const TABS: [Tab, string][] = [['hoy', 'Hoy'], ['semana', 'La semana'], ['plan', 'Mi plan']]

export default function App() {
  const [tab, setTab] = useState<Tab>('hoy')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const app = useAppState()

  // Dia visible en Hoy. Arranca en hoy; el calendario navega hacia atras.
  const [viewDate, setViewDate] = useState(app.today)
  // Si pasan las 0:00, lo que era hoy pasa a ser ayer: no se mueve nada, el
  // usuario sigue viendo el mismo dia real hasta que toque "Hoy".
  const goToday = useCallback(() => setViewDate(app.today), [app.today])

  const handleTabChange = useCallback((newTab: Tab) => {
    if (newTab === tab) void app.refreshFromCloud()
    setTab(newTab)
  }, [tab, app])

  // Pull-to-refresh: sincroniza, no recarga la app (recargar perdia el scroll
  // y en iOS forzaba una revalidacion completa del service worker).
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const pulling = useRef(false)
  const threshold = 80

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.currentTarget as HTMLElement).scrollTop <= 0) {
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
    if (pulling.current && pullDistance >= threshold) void app.refreshFromCloud()
    pulling.current = false
    setPullDistance(0)
  }, [pullDistance, app])

  const todayDate = parseDate(app.today) ?? new Date()
  const viewDateObj = parseDate(viewDate) ?? todayDate
  const trend7 = weightAvg(app.state.records, addDays(viewDate, -6), viewDate)
  const viewingToday = viewDate === app.today

  // Primer arranque: no se muestra nada mas hasta tener objetivos. Se espera a
  // la nube para no pedirselos a alguien que ya los tiene guardados.
  if (!app.state.settings.setupDone && !app.loadingInitial) {
    return (
      <div className="app-shell">
        <div className="app-header-safe" />
        <main className="app-content">
          <div className="mx-root">
            <div className="mx-shell">
              <SetupScreen onDone={targets => app.updateSettings({ targets, setupDone: true })} />
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-header-safe" />

      <main
        className="app-content"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="pull-indicator" style={{ height: pullDistance > 10 ? pullDistance : 0 }}>
          {pullDistance > 10 && (
            <span style={{ color: pullDistance >= threshold ? 'var(--good)' : 'var(--mute)' }}>
              {app.refreshing ? 'Sincronizando' : pullDistance >= threshold ? 'Soltar para sincronizar' : 'Tirar para sincronizar'}
            </span>
          )}
        </div>

        {/* La app NUNCA se bloquea por un fallo de red: se registra igual y se
            sube al reconectar. El banner solo informa. */}
        {app.offline && (
          <div className="mx-banner" data-tone="warn">
            <span>⚠</span>
            <span>
              {app.loadError ?? 'Sin conexion con tu nube.'} Puedes seguir registrando: se guarda
              en el telefono y se sube solo al reconectar.
            </span>
          </div>
        )}

        <div className="mx-root">
          <div className="mx-shell">
            <div className="mx-head">
              <div>
                <div className="mx-eyebrow">
                  {headerDate(viewDateObj)} · semana {String(isoWeek(viewDateObj)).padStart(2, '0')}
                  {!viewingToday && (
                    <button className="mx-mini mx-go-today" onClick={goToday}>Hoy</button>
                  )}
                </div>
                <h1>Traza</h1>
                <SaveDot
                  status={app.saveStatus}
                  offline={app.offline}
                  onRetry={app.retrySave}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="mx-eyebrow">Tendencia 7d</div>
                  <div className="mx-mono" style={{ fontSize: 15, fontWeight: 600 }}>
                    {trend7 !== null ? `${trend7.toFixed(1)} kg` : '—'}
                  </div>
                </div>
                <button className="mx-gear" onClick={() => setSettingsOpen(true)} aria-label="Ajustes">⚙</button>
              </div>
            </div>

            <div className="mx-tabs">
              {TABS.map(([k, l]) => (
                <button
                  key={k}
                  className="mx-tab"
                  data-on={tab === k ? '1' : '0'}
                  onClick={() => handleTabChange(k)}
                >
                  {l}
                </button>
              ))}
            </div>

            {tab === 'hoy' && <TodayScreen app={app} viewDate={viewDate} setViewDate={setViewDate} goToday={goToday} />}
            {tab === 'semana' && <WeekScreen app={app} />}
            {tab === 'plan' && <PlanScreen app={app} />}
          </div>
        </div>
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        app={app}
      />
    </div>
  )
}
