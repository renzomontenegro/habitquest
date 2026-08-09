/// <reference types="vite-plugin-pwa/client" />
import { useCallback, useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export interface PWAUpdate {
  /** Hay una version nueva esperando: mostrar el aviso para actualizar. */
  needRefresh: boolean
  offlineReady: boolean
  /** Aplica la nueva version: activa el SW nuevo y recarga la pagina. */
  apply: () => void
  /** Fuerza una busqueda de version nueva ahora mismo. */
  check: () => Promise<boolean>
}

/**
 * Registra el service worker y expone el flujo de actualizacion. Antes esto
 * quedaba en modo autoUpdate sin que el SW manejara SKIP_WAITING, asi que la
 * app se quedaba con la version vieja guardada en cache hasta que alguien
 * borraba los datos del sitio. Ahora la version nueva se detecta, se avisa con
 * un boton y se aplica al tocarlo.
 */
export function usePWAUpdate(): PWAUpdate {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const updateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    if (updateRef.current) return
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    })
    updateRef.current = updateSW
  }, [])

  const apply = useCallback(() => {
    if (updateRef.current) void updateRef.current(true)
  }, [])

  const check = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return false
    await reg.update()
    return true
  }, [])

  return { needRefresh, offlineReady, apply, check }
}
