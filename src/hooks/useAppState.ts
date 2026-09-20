import { useState, useCallback, useEffect, useRef } from 'react'
import type { AppSettings, AppState, DayLog, Macros, MealLog, MealSlot, SavedMeal, SplitDay } from '../types'
import { storage } from '../lib/storage'
import { ROUTINE_TEMPLATE } from '../lib/config'
import { todayStr, uid } from '../lib/logic'
import {
  queueSave, flushSave, retryNow, saveNow, loadFromBackend, isSyncEnabled,
  subscribeSync, getSyncSnapshot, hasPendingChanges, estimateMeal,
  type SyncSnapshot,
} from '../lib/sync'
import { savePendingPhotos, loadPendingPhotos, clearPendingPhotos } from '../lib/pendingPhotos'

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
  // Estimaciones IA en curso (por id de comida): evita procesar dos veces.
  const processingEstimates = useRef<Set<string>>(new Set())
  const processEstimatesRef = useRef<((meal: MealLog, date: string) => Promise<void>) | null>(null)

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
      // Una comida pendiente de IA nunca la borra la nube: si el merge la
      // perdio (p. ej. recarga antes de subir), se repone desde lo local.
      for (const local of stateRef.current.records) {
        for (const meal of local.meals ?? []) {
          if (!meal.aiPending) continue
          const rec = merged.records.find(r => r.date === local.date)
          if (rec && !(rec.meals ?? []).some(m => m.id === meal.id)) {
            rec.meals = [...(rec.meals ?? []), meal]
          } else if (!rec) {
            merged.records.push({ date: local.date, meals: [meal] })
          }
        }
      }
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

  const updateRecord = useCallback((patch: Partial<DayLog>, date = todayStr()) => {
    patchRecord(date, r => ({ ...r, ...patch }))
  }, [patchRecord])

  // --- Comidas ---
  const addMeals = useCallback((meals: MealLog[], date = todayStr()) => {
    if (meals.length === 0) return
    patchRecord(date, r => ({ ...r, meals: [...(r.meals ?? []), ...meals] }))
  }, [patchRecord])

  /**
   * Registro rapido: la comida se guarda al instante con macros en cero y la
   * IA los completa en segundo plano (con o sin internet: si no hay, queda
   * pendiente y se procesa al reconectar). Las fotos quedan en el telefono
   * hasta que la estimacion funciona. Devuelve si las fotos se guardaron.
   */
  const logPendingMeal = useCallback((slot: MealSlot, note: string, photos: string[], date = todayStr()): boolean => {
    const id = uid('m')
    const trimmed = note.trim()
    const photosSaved = savePendingPhotos(id, photos)
    const meal: MealLog = {
      id,
      slot,
      portion: 1,
      at: Date.now(),
      custom: { name: trimmed ? trimmed.slice(0, 40) : 'Comida por estimar', prot: 0, carb: 0, grasa: 0 },
      ...(trimmed ? { note: trimmed } : {}),
      ai: true,
      aiPending: true,
    }
    mark(date)
    addMeals([meal], date)
    void processEstimatesRef.current?.(meal, date)
    return photosSaved
  }, [addMeals, mark])

  /** Procesa una estimacion pendiente: lo que devuelva la IA es lo que se registra. */
  const processOneEstimate = useCallback(async (meal: MealLog, date: string) => {
    const mealId = meal.id
    if (processingEstimates.current.has(mealId)) return
    if (!meal.aiPending) return
    processingEstimates.current.add(mealId)
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        patchRecord(date, r => ({
          ...r,
          meals: (r.meals ?? []).map(m => (m.id === mealId ? { ...m, aiError: 'Sin internet. Se reintentara solo.' } : m)),
        }))
        return
      }
      const stored = loadPendingPhotos(mealId)
      const images = stored.map(p => p.slice(p.indexOf(',') + 1))
      const { ok, data, error } = await estimateMeal(meal.slot, meal.note ?? '', images)
      if (ok && data) {
        clearPendingPhotos(mealId)
        mark(date)
        patchRecord(date, r => ({
          ...r,
          meals: (r.meals ?? []).map(m => {
            if (m.id !== mealId) return m
            const next = {
              ...m,
              custom: { name: data.nombre || 'Comida', prot: data.prot, carb: data.carb, grasa: data.grasa },
              ai: true as const,
            }
            delete next.aiPending
            delete next.aiError
            return next
          }),
        }))
      } else {
        mark(date)
        patchRecord(date, r => ({
          ...r,
          meals: (r.meals ?? []).map(m => (m.id === mealId ? { ...m, aiError: error ?? 'No se pudo estimar.' } : m)),
        }))
      }
    } finally {
      processingEstimates.current.delete(mealId)
    }
  }, [mark, patchRecord])

  // Espejo del procesador para los triggers (online / visible / arranque).
  useEffect(() => { processEstimatesRef.current = processOneEstimate }, [processOneEstimate])

  /** Reintento manual desde la tarjeta de la comida. */
  const retryEstimate = useCallback((mealId: string, date = todayStr()) => {
    const meal = stateRef.current.records.find(r => r.date === date)?.meals?.find(m => m.id === mealId)
    if (!meal) return
    const fresh: MealLog = { ...meal, aiPending: true }
    delete fresh.aiError
    patchRecord(date, r => ({
      ...r,
      meals: (r.meals ?? []).map(m => (m.id === mealId ? fresh : m)),
    }))
    void processEstimatesRef.current?.(fresh, date)
  }, [patchRecord])

  /** Registra una comida estimada por la IA: foto + texto -> macros. */
  const logAiMeal = useCallback((slot: MealSlot, name: string, macros: Macros, note?: string, date = todayStr()) => {
    addMeals([{
      id: uid('m'),
      slot,
      portion: 1,
      at: Date.now(),
      custom: { name, prot: macros.prot, carb: macros.carb, grasa: macros.grasa },
      ...(note ? { note } : {}),
      ai: true,
    }], date)
  }, [addMeals])

  const setPortion = useCallback((mealId: string, portion: number, date = todayStr()) => {
    patchRecord(date, r => ({
      ...r,
      meals: (r.meals ?? []).map(m => (m.id === mealId ? { ...m, portion } : m)),
    }))
  }, [patchRecord])

  /**
   * Procesa todas las estimaciones pendientes (arranque, reconexion y vuelta
   * a la app). Sin pendientes es un no-op barato.
   */
  const processPendingEstimates = useCallback(() => {
    for (const rec of stateRef.current.records) {
      for (const meal of rec.meals ?? []) {
        if (meal.aiPending) void processEstimatesRef.current?.(meal, rec.date)
      }
    }
  }, [])

  // Al arrancar con pendientes de otra sesion, al reconectar y al volver al
  // frente: la IA trabaja sola, sin que el usuario espere mirando el modal.
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') processPendingEstimates()
    }
    run()
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', run)
    return () => {
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', run)
    }
  }, [processPendingEstimates])

  /** Registra una comida repetida guardada (sin IA: copia sus macros). */
  const logSavedMeal = useCallback((slot: MealSlot, saved: SavedMeal, portion = 1, date = todayStr()) => {
    addMeals([{
      id: uid('m'),
      slot,
      portion,
      at: Date.now(),
      custom: { name: saved.name, prot: saved.prot, carb: saved.carb, grasa: saved.grasa },
      ...(saved.note ? { note: saved.note } : {}),
    }], date)
  }, [addMeals])

  const removeMeal = useCallback((mealId: string, date = todayStr()) => {
    clearPendingPhotos(mealId)
    patchRecord(date, r => ({ ...r, meals: (r.meals ?? []).filter(m => m.id !== mealId) }))
  }, [patchRecord])

  // --- Entrenamiento ---
  const setWorkout = useCallback((workoutId: string | null, date = todayStr()) => {
    patchRecord(date, r => ({ ...r, workoutId }))
  }, [patchRecord])

  const setSet = useCallback((exerciseId: string, index: number, field: 'weight' | 'reps', value: string, date = todayStr()) => {
    patchRecord(date, r => {
      const sets = { ...(r.sets ?? {}) }
      const list = [...(sets[exerciseId] ?? [])]
      while (list.length <= index) list.push({ weight: '', reps: '' })
      list[index] = { ...list[index], [field]: value }
      sets[exerciseId] = list
      return { ...r, sets }
    })
  }, [patchRecord])

  // --- Ajustes ---
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    mark()
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...patch } }))
  }, [mark])

  const setTargets = useCallback((targets: Macros) => updateSettings({ targets }), [updateSettings])

  /** Guarda (o actualiza) una comida como repetida en Mi plan. */
  const upsertSavedMeal = useCallback((saved: SavedMeal) => {
    mark()
    setState(prev => {
      const exists = prev.settings.savedMeals.some(m => m.id === saved.id)
      const savedMeals = exists
        ? prev.settings.savedMeals.map(m => (m.id === saved.id ? saved : m))
        : [...prev.settings.savedMeals, saved].slice(0, 30)
      return { ...prev, settings: { ...prev.settings, savedMeals } }
    })
  }, [mark])

  const removeSavedMeal = useCallback((id: string) => {
    mark()
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, savedMeals: prev.settings.savedMeals.filter(m => m.id !== id) },
    }))
  }, [mark])

  const upsertSplitDay = useCallback((day: SplitDay) => {
    mark()
    setState(prev => {
      const exists = prev.settings.split.some(d => d.id === day.id)
      const split = exists
        ? prev.settings.split.map(d => (d.id === day.id ? day : d))
        : [...prev.settings.split, day]
      return { ...prev, settings: { ...prev.settings, split } }
    })
  }, [mark])

  const removeSplitDay = useCallback((dayId: string) => {
    mark()
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, split: prev.settings.split.filter(d => d.id !== dayId) },
    }))
  }, [mark])

  /**
   * Materializa la plantilla de rutina como dias del usuario. Se AGREGA a lo
   * que ya exista, nunca lo reemplaza. Los ejercicios toman el nombre como id
   * para reconectar el historial de series del modelo viejo.
   */
  const loadRoutineTemplate = useCallback(() => {
    mark()
    setState(prev => {
      const existing = new Set(prev.settings.split.map(d => d.name.toLowerCase()))
      const nuevos: SplitDay[] = ROUTINE_TEMPLATE
        .filter(d => !existing.has(d.name.toLowerCase()))
        .map(d => ({
          id: uid('s'),
          name: d.name,
          weekday: d.weekday,
          exercises: d.exercises.map(e => ({ id: e.name, name: e.name, sets: e.sets, reps: e.reps })),
        }))
      if (nuevos.length === 0) return prev
      return { ...prev, settings: { ...prev.settings, split: [...prev.settings.split, ...nuevos] } }
    })
  }, [mark])

  /** Deja la rutina en blanco sin tocar el historial de registros. */
  const clearPlan = useCallback(() => {
    mark()
    setState(prev => ({ ...prev, settings: { ...prev.settings, split: [] } }))
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
    // registro
    updateRecord,
    logAiMeal,
    logPendingMeal,
    retryEstimate,
    setPortion,
    logSavedMeal,
    removeMeal,
    setWorkout,
    setSet,
    // ajustes
    updateSettings,
    setTargets,
    upsertSavedMeal,
    removeSavedMeal,
    upsertSplitDay,
    removeSplitDay,
    loadRoutineTemplate,
    clearPlan,
    // datos
    importState,
    exportState,
    resetState,
  }
}
