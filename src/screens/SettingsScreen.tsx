import type { AppState, DailyXPGoal } from '../types'
import { Toggle } from '../components/FormModal'

interface SettingsScreenProps {
  state: AppState
  syncEnabled: boolean
  syncError: string | null
  onUpdateSettings: (s: Partial<AppState['settings']>) => void
  onUpdateDailyGoal: (g: DailyXPGoal) => void
  onReset: () => void
}

export function SettingsScreen({ state, syncEnabled, syncError, onUpdateSettings, onUpdateDailyGoal, onReset }: SettingsScreenProps) {
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

      {/* Sync status */}
      {syncEnabled && (
        <Section title="Sincronizacion" subtitle="Tus datos se sincronizan automaticamente con la nube.">
          {syncError ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[13px] font-bold text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Error de sync
              </div>
              <p className="text-[11px] font-mono text-red-300/80 bg-red-900/20 rounded-lg px-3 py-2 break-all">
                {syncError}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-3d w-full !h-10 !text-[13px] bg-surface-700 border-surface-500 text-[#94A7B0]"
              >
                Reintentar sincronizacion
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-bold text-duo-green">
                <span className="w-2 h-2 rounded-full bg-duo-green animate-pulse" />
                Sync activo
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-[12px] font-bold text-[#5C7680] active:text-duo-green transition-colors"
              >
                Refrescar
              </button>
            </div>
          )}
        </Section>
      )}

      {/* Sonido */}
      <Section title="Sonido" subtitle="Efectos al completar habitos y subir de nivel.">
        <Toggle
          label="Efectos de sonido"
          value={state.settings.soundEnabled}
          onChange={v => onUpdateSettings({ soundEnabled: v })}
        />
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
        <p className="text-[11px] font-bold text-[#3C5564]">HabitQuest v1.5</p>
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
