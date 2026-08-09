const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isVapidConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY
}

/** Promesa con techo: si iOS no la resuelve, se corta y se sigue de largo. */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(`Tardo demasiado esperando ${what}`)), ms)
    p.then(v => { clearTimeout(id); resolve(v) }, e => { clearTimeout(id); reject(e) })
  })
}

/**
 * Pide el permiso una sola vez y devuelve si quedo concedido. En iOS la
 * promesa de requestPermission a veces nunca se resuelve aunque el usuario ya
 * contesto: con el techo se cae al estado real y no se queda "Pidiendo...".
 */
export async function ensurePushPermission(): Promise<boolean> {
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const perm = await withTimeout(Notification.requestPermission(), 12000, 'el permiso de notificaciones')
    return perm === 'granted'
  } catch {
    // La promesa se colgo en iOS aunque el usuario ya contesto: el estado real
    // manda. El cast es a proposito: TS deduce "default" por los returns de
    // arriba, pero en runtime el permiso ya pudo cambiar con el popup.
    return (Notification.permission as NotificationPermission) === 'granted'
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  return navigator.serviceWorker.getRegistration()
}

export async function getSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return null
  try {
    // Espera al SW ACTIVO, no al que quede "waiting": subscribe se cuelga si no.
    const reg = await withTimeout(navigator.serviceWorker.ready, 8000, 'el service worker')
    if (!reg) return null
    return await withTimeout(reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }), 12000, 'la suscripcion push')
  } catch {
    return null
  }
}
