import { useRef, useState } from 'react'
import { BottomSheet, ConfirmButton } from '../components/ui'
import { APP_VERSION } from '../lib/config'
import { usePWAUpdate } from '../hooks/usePWAUpdate'
import { getSubscription, isPushSupported, isVapidConfigured, subscribeToPush } from '../lib/notifications'
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
      const sub = (await getSubscription()) ?? (await subscribeToPush())
      if (!sub) {
        setNotifMsg('No se pudo suscribir. Revisa el permiso de notificaciones.')
        return
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
