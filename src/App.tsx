import { useState, useCallback, useRef } from 'react'
import { TodayScreen } from './screens/TodayScreen'
import { PlanScreen } from './screens/PlanScreen'
import { SettingsSheet } from './screens/SettingsSheet'
import { SetupScreen } from './screens/SetupScreen'
import { useAppState } from './hooks/useAppState'
import { usePWAUpdate } from './hooks/usePWAUpdate'
import { headerDate, isoWeek, parseDate } from './lib/logic'
import { APP_VERSION } from './lib/config'
import { SaveDot } from './components/ui'

type Tab = 'hoy' | 'plan'

const TABS: [Tab, string][] = [['hoy', 'Hoy'], ['plan', 'Mi plan']]

export default function App() {
  const [tab, setTab] = useState<Tab>('hoy')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const app = useAppState()
  const update = usePWAUpdate()

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
  // y en iOS forzaba una revalidacion completa del service worker). El
  // indicador se mueve con transform imperativo (sin re-renders por pixel) y
  // vuelve con una transicion suave.
  const [pullState, setPullState] = useState<'idle' | 'armed' | 'syncing'>('idle')
  const pullEl = useRef<HTMLDivElement>(null)
  const pullDist = useRef(0)
  const touchStartY = useRef(0)
  const pulling = useRef(false)
  const threshold = 80

  const applyPull = useCallback(() => {
    const el = pullEl.current
    if (!el) return
    const d = pullDist.current
    el.style.transform = `translateY(${d}px)`
    el.style.opacity = d > 8 ? String(Math.min(1, Math.max(0.3, d / threshold))) : '0'
    setPullState(prev => {
      const next = d >= threshold ? 'armed' : 'idle'
      return prev === next ? prev : next
    })
  }, [])

  const resetPull = useCallback((immediate: boolean) => {
    const el = pullEl.current
    pullDist.current = 0
    if (el) {
      el.style.transition = immediate ? 'none' : 'transform .3s cubic-bezier(.2,.8,.3,1), opacity .25s ease'
      el.style.transform = 'translateY(0px)'
      el.style.opacity = '0'
    }
    if (!immediate) setPullState('idle')
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // El pull no aplica dentro de modales/sheets: sus gestos son propios y el
    // evento bullea hasta el contenedor principal.
    const t = e.target as HTMLElement
    if (t.closest?.('.mx-sheet')) return
    if ((e.currentTarget as HTMLElement).scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY
      pulling.current = true
      if (pullEl.current) pullEl.current.style.transition = 'none'
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) {
      // Goma elastica: cada cm de arrastre mueve menos.
      pullDist.current = Math.min(dy * 0.45, 110)
      applyPull()
    } else {
      pulling.current = false
      resetPull(false)
    }
  }, [applyPull, resetPull])

  const onTouchEnd = useCallback(() => {
    if (pulling.current) {
      const armed = pullDist.current >= threshold
      if (armed) setPullState('syncing')
      pulling.current = false
      if (armed) void app.refreshFromCloud()
    }
    resetPull(false)
  }, [app, resetPull])

  const todayDate = parseDate(app.today) ?? new Date()
  const viewDateObj = parseDate(viewDate) ?? todayDate
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
        <div ref={pullEl} className="pull-indicator" style={{ transform: 'translateY(0px)', opacity: 0 }}>
          <span data-s={pullState === 'syncing' ? 'sync' : pullState === 'armed' ? 'arm' : 'idle'}>
            {pullState === 'syncing' ? 'Sincronizando' : pullState === 'armed' ? 'Soltar para sincronizar' : 'Tirar para sincronizar'}
          </span>
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

        {/* Version nueva lista: el SW viejo no se soltaba y por eso la app se
            quedaba en la version guardada en cache hasta borrar los datos del
            sitio. Ahora se avisa y se aplica con un tap. */}
        {update.needRefresh && (
          <div className="mx-banner" data-tone="info">
            <span>⬆</span>
            <span style={{ flex: 1 }}>Hay una version nueva de Traza. Actualiza para verla.</span>
            <button className="mx-banner-btn" onClick={update.apply}>Actualizar</button>
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
                <h1>Traza <span className="mx-ver">v{APP_VERSION}</span></h1>
                <SaveDot
                  status={app.saveStatus}
                  offline={app.offline}
                  onRetry={app.retrySave}
                />
              </div>
              <button className="mx-gear" onClick={() => setSettingsOpen(true)} aria-label="Abrir ajustes">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .63 1.7 1.7 0 0 0-.37 1.05V21h-4v-.08A1.7 1.7 0 0 0 8.57 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.63-1A1.7 1.7 0 0 0 2.52 13H2v-4h.52A1.7 1.7 0 0 0 4.2 7a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.57 2.6a1.7 1.7 0 0 0 1-.63A1.7 1.7 0 0 0 9.94 1h4v.08A1.7 1.7 0 0 0 15 2.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 7a1.7 1.7 0 0 0 .63 1 1.7 1.7 0 0 0 1.05.37H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
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
