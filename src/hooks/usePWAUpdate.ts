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
  /**
   * Refresco forzado a la ultima version: borra las caches del service worker,
   * busca la version nueva, la activa y recarga. Sirve incluso desde una
   * version vieja que no tiene el aviso "Actualizar".
   */
  force: () => void
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

  // Cada vez que se abre la app (y al volver a primer plano) se revisa si hay
  // version nueva. En iOS el SW tarda en soltarse, pero asi el aviso aparece
  // apenas el navegador vuelve a ver el sw.js nuevo.
  useEffect(() => {
    const probe = () => {
      if (document.visibilityState !== 'visible') return
      if (!('serviceWorker' in navigator)) return
      navigator.serviceWorker.getRegistration()
        .then(reg => { if (reg) void reg.update() })
        .catch(() => { /* sin SW activo: no pasa nada */ })
    }
    const id = window.setTimeout(probe, 1500)
    document.addEventListener('visibilitychange', probe)
    window.addEventListener('focus', probe)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('visibilitychange', probe)
      window.removeEventListener('focus', probe)
    }
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

  /** Espera a que el SW nuevo termine de instalar y quede en "waiting". */
  const waitForWaiting = useCallback(async (reg: ServiceWorkerRegistration): Promise<ServiceWorker | null> => {
    for (let i = 0; i < 20; i++) {
      if (reg.waiting) return reg.waiting
      if (reg.installing) {
        await new Promise(resolve => {
          reg.installing!.addEventListener('statechange', resolve, { once: true })
        })
        continue
      }
      await new Promise(resolve => window.setTimeout(resolve, 100))
    }
    return reg.waiting
  }, [])

  const force = useCallback(() => {
    void (async () => {
      // 1) Borra las caches del SW viejo: aunque no se llegue a activar la
      //    version nueva, una recarga normal ya no encuentra nada viejo y
      //    baja todo fresco de la red.
      if ('caches' in window) {
        try {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        } catch { /* sin acceso a caches: seguir */ }
      }

      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration()
          if (reg) {
            await reg.update()
            const waiting = await waitForWaiting(reg)
            if (waiting) {
              waiting.postMessage({ type: 'SKIP_WAITING' })
              // Recarga cuando el SW nuevo tome el control.
              const onController = () => {
                navigator.serviceWorker.removeEventListener('controllerchange', onController)
                window.location.reload()
              }
              navigator.serviceWorker.addEventListener('controllerchange', onController)
              // Red de seguridad por si el cambio de control no llega.
              window.setTimeout(() => {
                navigator.serviceWorker.removeEventListener('controllerchange', onController)
                window.location.reload()
              }, 3000)
              return
            }
          }
        }
      } catch { /* si el flujo del SW falla, la recarga de abajo igual funciona */ }

      window.location.reload()
    })()
  }, [waitForWaiting])

  return { needRefresh, offlineReady, apply, check, force }
}
