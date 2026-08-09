import type { AppState } from '../types'

const SYNC_URL = import.meta.env.VITE_SYNC_URL as string | undefined
const SYNC_TOKEN = import.meta.env.VITE_SYNC_TOKEN as string | undefined

// Debounce corto para no escribir en cada tecla, pero con techo: si sigues
// escribiendo sin parar, igual se guarda cada MAX_WAIT_MS.
const DEBOUNCE_MS = 1500
const MAX_WAIT_MS = 8000
const RETRY_MS = [4000, 10000, 30000, 60000]

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface SyncSnapshot {
  status: SaveStatus
  error: string | null
  lastSavedAt: number | null
}

// --- Estado del modulo ---
let pending: AppState | null = null // ultimo estado sin confirmar en la nube
let queuedSince: number | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let inFlight = false
let retryIndex = 0

let snapshot: SyncSnapshot = { status: 'idle', error: null, lastSavedAt: null }
const listeners = new Set<(s: SyncSnapshot) => void>()

function emit(patch: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...patch }
  for (const fn of listeners) fn(snapshot)
}

export function subscribeSync(fn: (s: SyncSnapshot) => void): () => void {
  listeners.add(fn)
  fn(snapshot)
  return () => { listeners.delete(fn) }
}

export function getSyncSnapshot(): SyncSnapshot {
  return snapshot
}

/** True si hay env vars de sync configuradas */
export function isSyncEnabled(): boolean {
  return !!SYNC_URL
}

// Traduce errores tecnicos a mensajes amigables
function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('no encontró ningún servidor') || msg.includes('hostname') || msg.includes('nodename nor servname') || msg.includes('Load failed'))
    return 'Sin conexion a Tailscale. Activa la VPN para sincronizar.'
  if (msg.includes('network') || msg.includes('Network') || msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return 'Sin conexion a internet.'
  if (msg.includes('timed out') || msg.includes('timeout'))
    return 'El servidor tardo demasiado en responder.'
  if (msg.includes('CORS') || msg.includes('access control'))
    return 'Error de permisos CORS en el servidor.'
  return msg
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (SYNC_TOKEN) headers['Authorization'] = `Bearer ${SYNC_TOKEN}`
  return headers
}

function getUrl(endpoint: 'habitquest-save' | 'habitquest-load' | 'habitquest-push'): string | null {
  if (!SYNC_URL) return null
  const base = SYNC_URL.replace(/\/$/, '')
  // Si la URL ya apunta a un endpoint especifico, reemplazar; si no, concatenar
  const cleaned = base.replace(/habitquest-(save|load)$/, endpoint)
  return cleaned.endsWith(endpoint) ? cleaned : `${cleaned}/${endpoint}`
}

// --- Carga ---

export async function loadFromBackend(): Promise<{ state: AppState | null; error: string | null }> {
  const url = getUrl('habitquest-load')
  if (!url) return { state: null, error: null }
  try {
    const res = await fetch(url, { method: 'GET', headers: buildHeaders() })
    if (!res.ok) return { state: null, error: `No se pudo cargar: ${res.status} ${res.statusText}` }

    const text = await res.text()
    if (!text || text === '{}') return { state: null, error: null }

    let data: unknown
    try { data = JSON.parse(text) } catch { return { state: null, error: 'La nube devolvio datos ilegibles.' } }

    if (data && typeof data === 'object' && 'records' in data) return { state: data as AppState, error: null }
    return { state: null, error: null }
  } catch (e) {
    return { state: null, error: friendlyError(e) }
  }
}

// --- Guardado ---

async function post(state: AppState, keepalive = false): Promise<{ ok: boolean; error: string | null }> {
  const url = getUrl('habitquest-save')
  if (!url) return { ok: false, error: null }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(state),
      keepalive,
    })
    if (!res.ok) return { ok: false, error: `No se pudo guardar: ${res.status} ${res.statusText}` }
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: friendlyError(e) }
  }
}

function clearTimer(): void {
  if (timer) { clearTimeout(timer); timer = null }
}

async function run(): Promise<void> {
  clearTimer()
  if (inFlight || !pending) return

  const attempt = pending
  inFlight = true
  emit({ status: 'saving' })

  const { ok, error } = await post(attempt)
  inFlight = false

  if (ok) {
    retryIndex = 0
    // Si llegaron cambios nuevos mientras guardabamos, `pending` ya no es `attempt`.
    if (pending === attempt) {
      pending = null
      queuedSince = null
      emit({ status: 'saved', error: null, lastSavedAt: Date.now() })
    } else {
      emit({ status: 'pending', error: null, lastSavedAt: Date.now() })
      schedule()
    }
    return
  }

  // Fallo: NO se descarta el cambio. Queda en cola y se reintenta con backoff.
  emit({ status: 'error', error })
  const wait = RETRY_MS[Math.min(retryIndex, RETRY_MS.length - 1)]
  retryIndex++
  clearTimer()
  timer = setTimeout(() => { void run() }, wait)
}

function schedule(): void {
  if (!pending) return
  const now = Date.now()
  if (queuedSince === null) queuedSince = now
  const cap = queuedSince + MAX_WAIT_MS - now
  const wait = Math.max(0, Math.min(DEBOUNCE_MS, cap))
  clearTimer()
  timer = setTimeout(() => { void run() }, wait)
}

/** Encola el estado para guardar. Nunca descarta: si falla, reintenta. */
export function queueSave(state: AppState): void {
  if (!SYNC_URL) return
  pending = state
  if (queuedSince === null) queuedSince = Date.now()
  if (snapshot.status !== 'saving') emit({ status: 'pending' })
  schedule()
}

/**
 * Guarda ya, sin esperar el debounce. `keepalive` permite que la peticion
 * sobreviva a que la PWA se vaya a segundo plano (iOS mata los timers).
 */
export function flushSave(): void {
  if (!SYNC_URL || !pending || inFlight) return
  clearTimer()
  const attempt = pending
  void post(attempt, true).then(({ ok, error }) => {
    if (ok) {
      if (pending === attempt) { pending = null; queuedSince = null }
      emit({ status: pending ? 'pending' : 'saved', error: null, lastSavedAt: Date.now() })
    } else {
      emit({ status: 'error', error })
    }
  })
}

/** Reintento manual desde la UI */
export function retryNow(): void {
  retryIndex = 0
  clearTimer()
  void run()
}

/** True si hay cambios sin confirmar en la nube */
export function hasPendingChanges(): boolean {
  return pending !== null
}

/**
 * Registra la suscripcion push en el backend. Sin esto nadie puede enviar un
 * aviso: el navegador tiene la suscripcion pero el servidor no la conoce.
 * Requiere un webhook POST /webhook/habitquest-push en n8n que la guarde.
 */
export async function registerPushSubscription(sub: PushSubscription): Promise<{ ok: boolean; error: string | null }> {
  const url = getUrl('habitquest-push')
  if (!url) return { ok: false, error: 'No hay servidor de sincronizacion configurado.' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ subscription: sub.toJSON(), registeredAt: new Date().toISOString() }),
    })
    if (!res.ok) {
      return res.status === 404
        ? { ok: false, error: 'El servidor no tiene el webhook habitquest-push. Hay que crearlo en n8n.' }
        : { ok: false, error: `El servidor respondio ${res.status}.` }
    }
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: friendlyError(e) }
  }
}

/**
 * Envia un push de prueba usando el webhook sistema-push-send del backend
 * (workflow "Sistema Push"). El payload va anidado en `body` porque asi lo lee
 * el Code node: title y body custom, o el recordatorio por defecto si no van.
 */
export async function sendTestPush(title: string, body: string): Promise<{ ok: boolean; error: string | null }> {
  const pushBase = getUrl('habitquest-push')
  if (!pushBase) return { ok: false, error: 'No hay servidor de sincronizacion configurado.' }
  const url = pushBase.replace(/habitquest-push$/, 'sistema-push-send')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ body: { title, body } }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `El servidor respondio ${res.status}. ${text.slice(0, 120)}` }
    }
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: friendlyError(e) }
  }
}

/** Guardado inmediato y esperable (reset, import) */
export async function saveNow(state: AppState): Promise<boolean> {
  const { ok, error } = await post(state)
  emit(ok ? { status: 'saved', error: null, lastSavedAt: Date.now() } : { status: 'error', error })
  return ok
}
