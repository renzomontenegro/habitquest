/**
 * Fotos pendientes de estimacion por IA. Viven SOLO en el localStorage del
 * telefono, fuera del AppState: asi nunca viajan a la nube (la foto va a la
 * IA y se descarta) y sobreviven recargas hasta que la estimacion funciona o
 * el usuario borra la comida. Clave por id de comida.
 */

const KEY = 'sistema_pending_photos'
const MAX_ENTRIES = 10

type PendingPhotos = Record<string, { photos: string[]; at: number }>

function readAll(): PendingPhotos {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return {}
    const out: PendingPhotos = {}
    for (const [id, entry] of Object.entries(v as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue
      const photos = (entry as { photos?: unknown }).photos
      if (!Array.isArray(photos)) continue
      const list = photos.filter((p): p is string => typeof p === 'string' && p.length > 100)
      if (list.length > 0) out[id] = { photos: list.slice(0, 10), at: Date.now() }
    }
    return out
  } catch {
    return {}
  }
}

/** Guarda las fotos. Devuelve false si no hubo espacio (cuota de localStorage). */
export function savePendingPhotos(mealId: string, photos: string[]): boolean {
  const list = photos.filter(p => typeof p === 'string' && p.length > 100).slice(0, 10)
  if (list.length === 0) return true
  try {
    const all = readAll()
    all[mealId] = { photos: list, at: Date.now() }
    // Tope de entradas para no crecer sin limite (las viejas ya fallaron igual).
    const ids = Object.keys(all)
    if (ids.length > MAX_ENTRIES) {
      ids.sort((a, b) => all[a].at - all[b].at)
      for (const drop of ids.slice(0, ids.length - MAX_ENTRIES)) delete all[drop]
    }
    localStorage.setItem(KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}

export function loadPendingPhotos(mealId: string): string[] {
  return readAll()[mealId]?.photos ?? []
}

export function clearPendingPhotos(mealId: string): void {
  try {
    const all = readAll()
    if (!(mealId in all)) return
    delete all[mealId]
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* sin espacio, se ignora */
  }
}
