import type { AppState } from '../types'

const SYNC_URL = import.meta.env.VITE_SYNC_URL as string | undefined
const SYNC_TOKEN = import.meta.env.VITE_SYNC_TOKEN as string | undefined

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastSyncError: string | null = null

// Traduce errores técnicos a mensajes amigables
function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('no encontró ningún servidor') || msg.includes('hostname') || msg.includes('nodename nor servname'))
    return 'Sin conexion a Tailscale. Activa la VPN para sincronizar.'
  if (msg.includes('network') || msg.includes('Network') || msg.includes('Failed to fetch'))
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

function getUrl(endpoint: 'habitquest-save' | 'habitquest-load'): string | null {
  if (!SYNC_URL) return null
  const base = SYNC_URL.replace(/\/$/, '')
  // Si la URL ya apunta a un endpoint específico, reemplazar; si no, concatenar
  const cleaned = base.replace(/habitquest-(save|load)$/, endpoint)
  return cleaned.endsWith(endpoint) ? cleaned : `${cleaned}/${endpoint}`
}

/** Último error de sync (null si ok o sync deshabilitado) */
export function getSyncError(): string | null {
  return lastSyncError
}

/** True si hay env vars de sync configuradas */
export function isSyncEnabled(): boolean {
  return !!SYNC_URL
}

// Cargar estado desde el backend (n8n -> Google Sheets)
export async function loadFromBackend(): Promise<AppState | null> {
  const url = getUrl('habitquest-load')
  if (!url) return null
  try {
    const res = await fetch(url, { method: 'GET', headers: buildHeaders() })
    if (!res.ok) {
      lastSyncError = `Load falló: ${res.status} ${res.statusText}`
      return null
    }
    lastSyncError = null

    const text = await res.text()
    if (!text || text === '{}') return null

    let data: unknown
    try { data = JSON.parse(text) } catch { return null }

    if (data && typeof data === 'object' && 'profile' in data && 'habits' in data) {
      return data as AppState
    }
    return null
  } catch (e) {
    lastSyncError = friendlyError(e)
    return null
  }
}

// Guardar estado al backend
export async function saveToBackend(state: AppState): Promise<boolean> {
  const url = getUrl('habitquest-save')
  if (!url) return false
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(state),
    })
    if (!res.ok) {
      lastSyncError = `Save falló: ${res.status} ${res.statusText}`
      return false
    }
    lastSyncError = null
    return true
  } catch (e) {
    lastSyncError = friendlyError(e)
    return false
  }
}

// Auto-save con debounce (3 segundos), notifica errores via callback
export function debouncedSave(state: AppState, onError?: (err: string | null) => void): void {
  if (!SYNC_URL) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    await saveToBackend(state)
    onError?.(lastSyncError)
  }, 3000)
}
