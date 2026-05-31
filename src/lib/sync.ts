import type { AppState } from '../types'

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function buildHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

// Cargar estado desde el backend (n8n -> Google Sheets)
export async function loadFromBackend(syncUrl: string, syncToken: string): Promise<AppState | null> {
  if (!syncUrl) return null
  try {
    const url = syncUrl.replace(/\/$/, '')
    const loadUrl = url.replace(/habitquest-save$/, 'habitquest-load')
    const finalUrl = loadUrl.endsWith('habitquest-load') ? loadUrl : `${loadUrl}/habitquest-load`

    const res = await fetch(finalUrl, {
      method: 'GET',
      headers: buildHeaders(syncToken),
    })
    if (!res.ok) return null

    const text = await res.text()
    if (!text || text === '{}') return null

    // Intentar parsear — puede venir como JSON directo o como string escapado
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return null
    }

    // Si es un AppState válido directamente
    if (data && typeof data === 'object' && 'profile' in data && 'habits' in data) {
      return data as AppState
    }

    return null
  } catch {
    // Offline o error de red — no romper la app
    return null
  }
}

// Guardar estado al backend (n8n -> Google Sheets)
export async function saveToBackend(syncUrl: string, syncToken: string, state: AppState): Promise<boolean> {
  if (!syncUrl) return false
  try {
    const url = syncUrl.replace(/\/$/, '')
    const saveUrl = url.replace(/habitquest-load$/, 'habitquest-save')
    const finalUrl = saveUrl.endsWith('habitquest-save') ? saveUrl : `${saveUrl}/habitquest-save`

    const res = await fetch(finalUrl, {
      method: 'POST',
      headers: buildHeaders(syncToken),
      body: JSON.stringify(state),
    })
    return res.ok
  } catch {
    return false
  }
}

// Auto-save con debounce (3 segundos)
export function debouncedSave(syncUrl: string, syncToken: string, state: AppState): void {
  if (!syncUrl) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    saveToBackend(syncUrl, syncToken, state)
  }, 3000)
}
