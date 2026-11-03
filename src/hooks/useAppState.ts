import { useState, useCallback, useEffect, useRef } from 'react'
import type { AppState, DayLog, Goal } from '../types'
import { storage } from '../lib/storage'
import { todayStr } from '../lib/logic'
import {
  queueSave, flushSave, retryNow, saveNow, loadFromBackend, isSyncEnabled,
  subscribeSync, getSyncSnapshot, hasPendingChanges,
  type SyncSnapshot,
} from '../lib/sync'

const PENDING_KEY = 'sistema_pending'

/** Fechas y ajustes tocados sin confirmacion de la nube (para no perderlos al reconectar). */
interface PendingMarks { dates: string[]; settings: boolean }

function readMarks(): PendingMarks {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return { dates: [], settings: false }
    const v = JSON.parse(raw) as Partial<PendingMarks>
    return { dates: Array.isArray(v.dates) ? v.dates.filter(d => typeof d === 'string') : [], settings: v.settings === true }
  } catch {
    return { dates: [], settings: false }
  }
}

function writeMarks(m: PendingMarks): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(m)) } catch { /* sin espacio, se ignora */ }
}

/**
 * Une lo que vino de la nube con lo que se edito sin conexion. Gana lo local
 * solo en las fechas marcadas como pendientes; el resto viene de la nube.
 */
function mergeStates(remote: AppState, local: AppState, marks: PendingMarks): AppState {
  const byDate = new Map(remote.records.map(r => [r.date, r]))
  for (const date of marks.dates) {
    const localRec = local.records.find(r => r.date === date)
    if (localRec) byDate.set(date, localRec)
    else byDate.delete(date)
  }
  const records = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  return { records, settings: marks.settings ? local.settings : remote.settings }
}

/** Fecha de hoy, con rollover a medianoche sin necesidad de recargar. */
function useToday(): string {
  const [today, setToday] = useState(todayStr)
  useEffect(() => {
    const tick = () => setToday(prev => {
      const now = todayStr()
      return now === prev ? prev : now
    })
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])
  return today
}

export type AppController = ReturnType<typeof useAppState>

export function useAppState() {
  const [state, setState] = useState<AppState>(() => storage.load())
  const [sync, setSync] = useState<SyncSnapshot>(getSyncSnapshot)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const today = useToday()

  // Sin sync configurado todo es local, asi que ya esta "listo" desde el arranque.
  const [cloudReady, setCloudReady] = useState(!isSyncEnabled())
  // Evita mostrar el onboarding a alguien que si tiene plan guardado en la nube.
  const [loadingInitial, setLoadingInitial] = useState(isSyncEnabled())
  const marks = useRef<PendingMarks>(readMarks())
  const stateRef = useRef(state)

  // Espejo para leer el valor actual desde callbacks y timers sin recrearlos.
  useEffect(() => { stateRef.current = state }, [state])

  const mark = useCallback((date?: string) => {
    const m = marks.current
    if (date) { if (!m.dates.includes(date)) m.dates.push(date) }
    else m.settings = true
    writeMarks(m)
  }, [])

  // --- Suscripcion al estado de sync ---
  useEffect(() => subscribeSync(setSync), [])

  // Cuando la nube confirma, ya no hay nada pendiente que proteger.
  useEffect(() => {
    if (sync.status === 'saved' && !hasPendingChanges()) {
      marks.current = { dates: [], settings: false }
      writeMarks(marks.current)
    }
  }, [sync.status])

  // --- Persistencia: local siempre, nube cuando ya sabemos que hay en ella ---
  useEffect(() => {
    storage.save(state)
    if (cloudReady) queueSave(state)
  }, [state, cloudReady])

  const pullFromCloud = useCallback(async (): Promise<void> => {
    if (!isSyncEnabled()) return
    const { state: remote, error } = await loadFromBackend()
    setLoadError(error)
    setLoadingInitial(false)
    if (error) return // sin datos frescos no se sube nada: se evita pisar la nube
    if (remote) {
      const clean = storage.sanitize(remote)
      const merged = mergeStates(clean, stateRef.current, marks.current)
      // Solo actualiza si el merge trajo algo distinto: evita repeticiones
      // (que encadenarían otro guardado) cuando la nube ya coincide con local.
      if (JSON.stringify(merged) !== JSON.stringify(stateRef.current)) {
        setState(merged)
        storage.save(merged)
      }
    }
    setCloudReady(true)
    // Si quedaban cambios offline, ahora si se suben.
    if (marks.current.dates.length > 0 || marks.current.settings) queueSave(stateRef.current)
  }, [])

  // Carga inicial. La regla no ve que los setState ocurren despues del await:
  // esto es exactamente sincronizar con un sistema externo.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void pullFromCloud() }, [pullFromCloud])

  // Reconciliacion periodica: revisa la nube cada 30 s y tambien al volver al
  // frente o reconectar. Como el merge respeta las fechas en edicion (marks),
  // esto NO pisa lo que estes escribiendo; solo adopta lo que escribio el otro
  // dispositivo. Sin esto, dos dispositivos abiertos se pisan enteros al
  // guardar (el ultimo ganaba y podia borrar campos del mismo dia, p. ej. el
  // bedTime del sueno que escribio el otro).
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState === 'visible') void pullFromCloud()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    const id = setInterval(retry, 30_000)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
      clearInterval(id)
    }
  }, [pullFromCloud])

  // iOS mata los timers al mandar la PWA a segundo plano: hay que forzar el envio.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushSave() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushSave)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushSave)
    }
  }, [])

  const refreshFromCloud = useCallback(async () => {
    setRefreshing(true)
    flushSave()
    await pullFromCloud()
    setRefreshing(false)
  }, [pullFromCloud])

  // --- Registro diario ---
  const patchRecord = useCallback((date: string, fn: (r: DayLog) => DayLog) => {
    mark(date)
    setState(prev => {
      const idx = prev.records.findIndex(r => r.date === date)
      const current = idx >= 0 ? prev.records[idx] : { date }
      const next = fn(current)
      const records = [...prev.records]
      if (idx >= 0) records[idx] = next
      else { records.push(next); records.sort((a, b) => (a.date < b.date ? -1 : 1)) }
      return { ...prev, records }
    })
  }, [mark])

  /** Registra (o borra, con undefined) el peso de un dia. */
  const setWeight = useCallback((weight: number | undefined, date = todayStr()) => {
    patchRecord(date, r => {
      const next = { ...r }
      if (weight === undefined) delete next.weight
      else next.weight = weight
      return next
    })
  }, [patchRecord])

  // --- Metas ---
  /** Guarda (o actualiza) una meta de peso por evento. */
  const upsertGoal = useCallback((goal: Goal) => {
    mark()
    setState(prev => {
      const exists = prev.settings.goals.some(g => g.id === goal.id)
      const goals = exists
        ? prev.settings.goals.map(g => (g.id === goal.id ? goal : g))
        : [...prev.settings.goals, goal].slice(0, 20)
      goals.sort((a, b) => a.date.localeCompare(b.date))
      return { ...prev, settings: { ...prev.settings, goals } }
    })
  }, [mark])

  const removeGoal = useCallback((id: string) => {
    mark()
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, goals: prev.settings.goals.filter(g => g.id !== id) },
    }))
  }, [mark])

  // --- Import / Export / Reset ---
  const importState = useCallback((json: string): boolean => {
    const imported = storage.importJSON(json)
    if (!imported) return false
    mark()
    for (const r of imported.records) mark(r.date)
    setState(imported)
    return true
  }, [mark])

  const exportState = useCallback((): string => storage.exportJSON(state), [state])

  const resetState = useCallback(async () => {
    storage.clear()
    marks.current = { dates: [], settings: false }
    writeMarks(marks.current)
    const fresh = storage.load()
    if (isSyncEnabled()) await saveNow(fresh)
    window.location.reload()
  }, [])

  return {
    state,
    today,
    // sync
    saveStatus: sync.status,
    saveError: sync.error,
    lastSavedAt: sync.lastSavedAt,
    loadError,
    loadingInitial,
    offline: !cloudReady && isSyncEnabled(),
    syncEnabled: isSyncEnabled(),
    refreshing,
    refreshFromCloud,
    retrySave: retryNow,
    // peso y metas
    setWeight,
    upsertGoal,
    removeGoal,
    // datos
    importState,
    exportState,
    resetState,
  }
}
