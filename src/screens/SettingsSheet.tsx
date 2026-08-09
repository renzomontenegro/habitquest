import { useRef, useState } from 'react'
import { BottomSheet, ConfirmButton } from '../components/ui'
import { APP_VERSION } from '../lib/config'
import { usePWAUpdate } from '../hooks/usePWAUpdate'
import { getSubscription, ensurePushPermission, isPushSupported, isVapidConfigured, subscribeToPush } from '../lib/notifications'
import { registerPushSubscription } from '../lib/sync'
import type { AppController } from '../hooks/useAppState'

function agoLabel(ts: number | null): string {
  if (!ts) return 'todavia no'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'hace segundos'
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`
  return new Date(ts).toLocaleDateString('es-PE')
}

export function SettingsSheet({ open, onClose, app }: {
  open: boolean
  onClose: () => void
  app: AppController
}) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [notifMsg, setNotifMsg] = useState<string | null>(null)
  const [updMsg, setUpdMsg] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pushReady = isPushSupported() && isVapidConfigured()
  const pwa = usePWAUpdate()

  const checkUpdate = async () => {
    setUpdMsg(null)
    const ok = await pwa.check()
    if (!ok) { setUpdMsg('No hay un service worker registrado para revisar.') ; return }
    setUpdMsg('Revisado. Si hay una version nueva, aparece el aviso "Actualizar" arriba.')
  }

  const forceUpdate = () => {
    setUpdMsg('Borrando cache y recargando a la ultima version...')
    pwa.force()
  }

  const doExport = () => {
    const blob = new Blob([app.exportState()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sistema-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImportFile = async (file: File) => {
    const text = await file.text()
    const ok = app.importState(text)
    setMsg(ok
      ? { text: 'Respaldo restaurado. Se subira a la nube en unos segundos.', ok: true }
      : { text: 'Ese archivo no es un respaldo valido.', ok: false })
  }

  const doActivate = async () => {
    if (!pushReady) {
      setNotifMsg('Este navegador no soporta push o falta el VAPID key.')
      return
    }
    setActivating(true)
    setNotifMsg('Pidiendo permiso...')
    try {
      const granted = await ensurePushPermission()
      if (!granted) {
        setNotifMsg('Sin permiso no se puede. Si lo bloqueaste, activa las notificaciones de Traza en Ajustes del sistema.')
        return
      }
      setNotifMsg('Suscribiendo...')
      const existing = await getSubscription()
      let sub = existing
      if (!sub) {
        const res = await subscribeToPush()
        sub = res.sub
        if (!sub) {
          const standalone = window.matchMedia('(display-mode: standalone)').matches
          setNotifMsg(standalone
            ? `No se pudo suscribir: ${res.error ?? 'sin detalle'}. Cierra la app desde el app switcher y vuelve a Activar.`
            : 'En iPhone el push solo funciona en la app INSTALADA: Compartir → Añadir a pantalla de inicio, y activar desde ahi.')
          return
        }
      }
      // Suscribirse no basta: si el servidor no guarda la suscripcion, nadie
      // puede enviar nada. Por eso el estado depende del registro, no del permiso.
      setNotifMsg('Registrando en el servidor...')
      const { ok, error } = await registerPushSubscription(sub)
      setNotifMsg(ok
        ? 'Listo. Este dispositivo queda registrado y puede recibir avisos.'
        : `Permiso concedido, pero no quedo registrado: ${error}`)
    } finally {
      setActivating(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Ajustes">
      <div className="space-y-5">
        <div>
          <div className="mx-lbl" style={{ marginBottom: 4 }}>Sincronizacion</div>
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            {app.syncEnabled
              ? <>Tus datos se guardan solos en la nube. Ultimo guardado confirmado: {agoLabel(app.lastSavedAt)}.</>
              : <>No hay nube configurada: los datos viven solo en este dispositivo.</>}
          </div>
          {app.saveError && <div className="mx-import-msg mx-import-msg--err">{app.saveError}</div>}
          {app.offline && app.loadError && <div className="mx-import-msg mx-import-msg--err">{app.loadError}</div>}
          <div className="mx-acts">
            <button className="mx-btn" data-p="1" onClick={() => void app.refreshFromCloud()} disabled={app.refreshing}>
              {app.refreshing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
            <button className="mx-btn" onClick={checkUpdate}>Buscar actualizaciones</button>
            {app.saveStatus === 'error' && (
              <button className="mx-btn" onClick={app.retrySave}>Reintentar guardado</button>
            )}
          </div>
          {updMsg && <div className="mx-import-msg" style={{ marginTop: 8 }}>{updMsg}</div>}

          <div className="mx-row" style={{ marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <div className="mx-lbl">¿Quedaste en una version vieja?</div>
              <div className="mx-sub" style={{ lineHeight: 1.5 }}>
                Borra la cache del service worker y recarga a la ultima version. No toca tus datos
                (estan en la nube). Sirve aun si nunca aparece el aviso de actualizacion.
              </div>
            </div>
          </div>
          <div className="mx-acts">
            <button className="mx-btn" data-tone="warn" onClick={forceUpdate}>Forzar actualizacion</button>
          </div>
        </div>

        <div>
          <div className="mx-lbl" style={{ marginBottom: 4 }}>Respaldo manual</div>
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Una copia en archivo, por si alguna vez quieres mover todo a otro lado.
            El respaldo del dia a dia ya lo hace la nube.
          </div>
          {msg && (
            <div className={`mx-import-msg ${msg.ok ? '' : 'mx-import-msg--err'}`}>{msg.text}</div>
          )}
          <div className="mx-acts">
            <button className="mx-btn" onClick={doExport}>Exportar archivo</button>
            <button className="mx-btn" onClick={() => fileRef.current?.click()}>Restaurar archivo</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) void doImportFile(f)
              e.target.value = ''
            }}
          />
        </div>

        <div>
          <div className="mx-lbl" style={{ marginBottom: 4 }}>Notificaciones push</div>
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Los avisos pueden llegar aun con la app cerrada. En iPhone requiere la PWA instalada.
            Ademas del permiso, este dispositivo tiene que quedar registrado en el servidor.
          </div>
          <div className="mx-acts">
            <button className="mx-btn" data-p="1" onClick={() => void doActivate()} disabled={activating}>
              {activating ? 'Activando...' : 'Activar'}
            </button>
          </div>
          {notifMsg && <div className="mx-import-msg" style={{ marginTop: 8 }}>{notifMsg}</div>}
        </div>

        <div>
          <div className="mx-lbl" style={{ marginBottom: 4 }}>Vaciar mi plan</div>
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Borra tus comidas y tu rutina para empezar el plan de cero.
            Tus registros de peso, pasos, sueno y series NO se tocan.
          </div>
          <ConfirmButton
            label="Vaciar plan"
            confirmLabel="Toca otra vez para vaciar"
            onConfirm={() => { app.clearPlan(); setMsg({ text: 'Plan vaciado. Crea tus comidas en Mi plan.', ok: true }) }}
          />
        </div>

        <div>
          <div className="mx-lbl" style={{ marginBottom: 4 }}>Zona peligrosa</div>
          <div className="mx-sub" style={{ marginBottom: 10 }}>
            Borra registros, objetivos, alimentos y rutina. No se puede deshacer.
          </div>
          <ConfirmButton
            label="Resetear todo"
            confirmLabel="Toca otra vez para borrar"
            onConfirm={() => void app.resetState()}
          />
        </div>

        <div className="mx-mono" style={{ fontSize: 10, color: 'var(--mute)', textAlign: 'center', paddingTop: 4 }}>
          Traza v{APP_VERSION}
        </div>
      </div>
    </BottomSheet>
  )
}
