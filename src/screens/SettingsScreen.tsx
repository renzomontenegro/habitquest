import { useState } from 'react'
import type { AppState, DailyXPGoal } from '../types'
import { Toggle, FormInput } from '../components/FormModal'
import { saveToBackend, loadFromBackend } from '../lib/sync'

interface SettingsScreenProps {
  state: AppState
  onUpdateSettings: (s: Partial<AppState['settings']>) => void
  onUpdateDailyGoal: (g: DailyXPGoal) => void
  onExport: () => string
  onImport: (json: string) => boolean
  onReset: () => void
}

export function SettingsScreen({ state, onUpdateSettings, onUpdateDailyGoal, onExport, onImport, onReset }: SettingsScreenProps) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'loading' | 'ok' | 'error'>('idle')

  const handleExport = () => {
    const json = onExport()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `habitquest-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const ok = onImport(reader.result as string)
        if (!ok) alert('Archivo invalido')
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSyncPush = async () => {
    setSyncStatus('saving')
    const ok = await saveToBackend(state.settings.syncUrl, state.settings.syncToken, state)
    setSyncStatus(ok ? 'ok' : 'error')
    setTimeout(() => setSyncStatus('idle'), 2500)
  }

  const handleSyncPull = async () => {
    setSyncStatus('loading')
    const remote = await loadFromBackend(state.settings.syncUrl, state.settings.syncToken)
    if (remote) {
      onImport(JSON.stringify(remote))
      setSyncStatus('ok')
    } else {
      setSyncStatus('error')
    }
    setTimeout(() => setSyncStatus('idle'), 2500)
  }

  return (
    <div className="px-4 pt-2 pb-8 space-y-4">
      <div>
        <h1 className="text-xl font-black text-white leading-tight mb-1">Ajustes</h1>
        <p className="text-[13px] font-bold text-[#5C7680]">Configura tu experiencia</p>
      </div>

      {/* Objetivo diario */}
      <Section title="Objetivo diario de XP" subtitle="Define cuanto XP necesitas por dia para mantener tu racha.">
        <div className="grid grid-cols-4 gap-2">
          {([10, 20, 30, 50] as DailyXPGoal[]).map(val => {
            const labels: Record<number, string> = { 10: 'Casual', 20: 'Regular', 30: 'Serio', 50: 'Insano' }
            const active = state.profile.dailyXPGoal === val
            return (
              <button
                key={val}
                onClick={() => onUpdateDailyGoal(val)}
                className={`py-2.5 rounded-xl font-black text-[13px] border-2 transition-all duration-100 ${
                  active
                    ? 'bg-duo-green border-duo-green-dark shadow-[0_3px_0_#43C000] text-white'
                    : 'bg-surface-700 border-surface-500 shadow-[0_3px_0_var(--color-surface-600)] text-[#94A7B0]'
                } active:shadow-none active:translate-y-[3px]`}
              >
                <div className="text-[17px]">{val}</div>
                <div className="text-[10px]">{labels[val]}</div>
              </button>
            )
          })}
        </div>
      </Section>

      {/* Sync */}
      <Section title="Sincronizacion" subtitle="Conecta con n8n para respaldar tus datos en Google Sheets. Los cambios se sincronizan automaticamente.">
        <div className="space-y-3">
          <FormInput
            label="URL del webhook"
            value={state.settings.syncUrl}
            onChange={v => onUpdateSettings({ syncUrl: v })}
            placeholder="https://n8n.example.com/webhook/"
          />
          <FormInput
            label="Token secreto"
            value={state.settings.syncToken}
            onChange={v => onUpdateSettings({ syncToken: v })}
            placeholder="Tu token de seguridad"
          />
          {state.settings.syncUrl && (
            <div className="flex gap-2">
              <button
                onClick={handleSyncPush}
                disabled={syncStatus !== 'idle'}
                className={`btn-3d flex-1 !h-11 !text-[12px] ${
                  syncStatus === 'ok' ? '!bg-duo-green !shadow-[0_5px_0_#43C000]' :
                  syncStatus === 'error' ? '!bg-duo-red !shadow-[0_5px_0_#E53838]' :
                  'btn-3d-purple'
                }`}
              >
                {syncStatus === 'saving' ? 'Subiendo...' :
                 syncStatus === 'ok' ? 'Listo!' :
                 syncStatus === 'error' ? 'Error' :
                 'Subir datos'}
              </button>
              <button
                onClick={handleSyncPull}
                disabled={syncStatus !== 'idle'}
                className="btn-3d btn-3d-blue flex-1 !h-11 !text-[12px]"
              >
                {syncStatus === 'loading' ? 'Cargando...' : 'Descargar datos'}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Sonido */}
      <Section title="Sonido" subtitle="Efectos al completar habitos y subir de nivel.">
        <Toggle
          label="Efectos de sonido"
          value={state.settings.soundEnabled}
          onChange={v => onUpdateSettings({ soundEnabled: v })}
        />
      </Section>

      {/* Datos */}
      <Section title="Datos" subtitle="Backup local en JSON.">
        <div className="flex gap-2.5">
          <button onClick={handleExport} className="btn-3d btn-3d-blue flex-1 !h-11 !text-[13px]">
            Exportar
          </button>
          <button onClick={handleImport} className="btn-3d btn-3d-orange flex-1 !h-11 !text-[13px]">
            Importar
          </button>
        </div>
      </Section>

      {/* Reset */}
      <Section title="Zona peligrosa" subtitle="Borra todo y empieza de cero. Esta accion no se puede deshacer.">
        <button
          onClick={() => {
            if (confirm('Estas seguro? Se borraran todos tus habitos, metas, logros y XP.')) {
              onReset()
            }
          }}
          className="btn-3d btn-3d-danger w-full !h-11 !text-[13px]"
        >
          Resetear todo
        </button>
      </Section>

      <div className="text-center pt-2 pb-2">
        <p className="text-[11px] font-bold text-[#3C5564]">HabitQuest v1.0</p>
        <p className="text-[11px] font-bold text-[#3C5564]">Tus datos se guardan localmente. El sync es opcional.</p>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card-3d">
      <h2 className="text-[13px] font-extrabold text-[#94A7B0] uppercase tracking-wider mb-1">{title}</h2>
      {subtitle && <p className="text-[11px] font-bold text-[#5C7680] leading-relaxed mb-3">{subtitle}</p>}
      {children}
    </div>
  )
}
