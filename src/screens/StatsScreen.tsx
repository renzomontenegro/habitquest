import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AppState } from '../types'
import { generateHeatmapData, habitStreak, completionRate, dailyXP } from '../lib/streaks'

interface StatsScreenProps {
  state: AppState
}

export function StatsScreen({ state }: StatsScreenProps) {
  const heatmap = useMemo(() => generateHeatmapData(state.habitLogs, state.habits), [state.habitLogs, state.habits])
  const rate7 = completionRate(state.habitLogs, state.habits, 7)
  const rate30 = completionRate(state.habitLogs, state.habits, 30)

  const xpChart = useMemo(() => {
    const data = []
    for (let i = 29; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      data.push({
        date: format(subDays(new Date(), i), 'dd/MM', { locale: es }),
        xp: dailyXP(state.habitLogs, state.habits, date),
      })
    }
    return data
  }, [state.habitLogs, state.habits])

  const maxCount = Math.max(...heatmap.map(d => d.count), 1)
  const unlockedCount = state.achievements.filter(a => a.unlockedAt).length

  if (state.habits.length === 0 && state.goals.length === 0) {
    return (
      <div className="px-4 pt-2 pb-8">
        <h1 className="text-xl font-black text-white leading-tight mb-1">Stats</h1>
        <p className="text-[13px] font-bold text-[#5C7680] mb-6">Tu progreso en numeros</p>
        <div className="card-3d text-center py-8 px-5">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-[17px] font-black text-white mb-2">Aun no hay datos</h3>
          <p className="text-[13px] font-bold text-[#5C7680] leading-relaxed">
            Crea habitos en la pestana "Hoy" y empieza a completarlos. Aqui veras tu heatmap, rachas, graficas de XP y logros.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-8 space-y-5">
      <div>
        <h1 className="text-xl font-black text-white leading-tight mb-1">Stats</h1>
        <p className="text-[13px] font-bold text-[#5C7680]">Tu progreso en numeros</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard label="7 dias" value={`${rate7}%`} sub="cumplimiento" color="text-duo-green" icon="📈" />
        <StatCard label="30 dias" value={`${rate30}%`} sub="cumplimiento" color="text-duo-blue" icon="📊" />
        <StatCard label="XP Total" value={state.profile.totalXP.toLocaleString()} sub="acumulado" color="text-duo-yellow" icon="💎" />
        <StatCard label="Nivel" value={state.profile.level.toString()} sub="actual" color="text-duo-purple" icon="⭐" />
      </div>

      {/* Heatmap */}
      <div>
        <h2 className="text-[13px] font-extrabold text-[#94A7B0] uppercase tracking-wider mb-2.5">Actividad anual</h2>
        <div className="card-3d overflow-x-auto py-3 px-3">
          <div className="flex gap-[3px]" style={{ width: 'max-content' }}>
            {Array.from({ length: 53 }, (_, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const idx = weekIdx * 7 + dayIdx
                  const cell = heatmap[idx]
                  if (!cell) return <div key={dayIdx} className="w-[10px] h-[10px]" />
                  const intensity = cell.count / maxCount
                  return (
                    <div
                      key={dayIdx}
                      className="w-[10px] h-[10px] rounded-[2px]"
                      style={{
                        backgroundColor: cell.count === 0
                          ? '#233742'
                          : `rgba(88, 204, 2, ${0.25 + intensity * 0.75})`,
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-[#5C7680]">
            <span>Menos</span>
            {[0, 0.25, 0.5, 0.75, 1].map(i => (
              <div key={i} className="w-[10px] h-[10px] rounded-[2px]"
                style={{ backgroundColor: i === 0 ? '#233742' : `rgba(88, 204, 2, ${0.25 + i * 0.75})` }}
              />
            ))}
            <span>Mas</span>
          </div>
        </div>
      </div>

      {/* XP Chart */}
      <div>
        <h2 className="text-[13px] font-extrabold text-[#94A7B0] uppercase tracking-wider mb-2.5">XP diario (30 dias)</h2>
        <div className="card-3d h-44 py-2 pr-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={xpChart}>
              <defs>
                <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFC800" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#FFC800" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#5C7680', fontWeight: 700 }} axisLine={false} tickLine={false} interval={6} />
              <YAxis tick={{ fontSize: 9, fill: '#5C7680', fontWeight: 700 }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={{ backgroundColor: '#1B2B32', border: '2px solid #3C5564', borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 12 }} />
              <Area type="monotone" dataKey="xp" stroke="#FFC800" strokeWidth={2.5} fill="url(#xpGradient)" dot={false} activeDot={{ r: 4, fill: '#FFC800', stroke: '#131F24', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rachas por hábito */}
      {state.habits.length > 0 && (
        <div>
          <h2 className="text-[13px] font-extrabold text-[#94A7B0] uppercase tracking-wider mb-2.5">Rachas por habito</h2>
          <div className="space-y-1.5">
            {state.habits.map(habit => {
              const s = habitStreak(state.habitLogs, habit.id)
              return (
                <div key={habit.id} className="card-3d !p-2.5 flex items-center gap-2.5">
                  <span className="text-xl">{habit.icon}</span>
                  <span className="flex-1 text-white font-bold text-[14px]">{habit.name}</span>
                  <div className={`badge-streak !py-0.5 !px-2.5 !text-[13px] ${s === 0 ? 'opacity-30' : ''}`}>
                    <span>🔥</span><span>{s}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* === Resumen de metas === */}
      {state.goals.length > 0 && (
        <div>
          <h2 className="text-[13px] font-extrabold text-[#94A7B0] uppercase tracking-wider mb-2.5">Metas</h2>
          <div className="space-y-1.5">
            {state.goals.map(goal => {
              const percent = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0
              const isComplete = percent >= 100
              return (
                <div key={goal.id} className={`card-3d !p-2.5 ${isComplete ? '!border-duo-green !shadow-[0_2px_0_#43C000]' : ''}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-xl">{goal.icon}</span>
                    <span className={`flex-1 font-bold text-[14px] truncate ${isComplete ? 'text-duo-green' : 'text-white'}`}>{goal.name}</span>
                    <span className={`text-[14px] font-black ${isComplete ? 'text-duo-green' : 'text-white'}`}>{Math.round(percent)}%</span>
                  </div>
                  <div className="progress-bar-track !h-2">
                    <div
                      className={`progress-bar-fill ${isComplete ? 'bg-duo-green' : 'bg-gradient-to-r from-duo-blue to-duo-purple'}`}
                      style={{ width: `${Math.max(percent, 1)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-[#5C7680] mt-1">
                    <span>{goal.currentAmount.toLocaleString()} {goal.unit}</span>
                    <span>{goal.targetAmount.toLocaleString()} {goal.unit}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Resumen total de aportes */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="card-3d text-center py-2.5">
              <div className="text-[10px] font-bold text-[#5C7680] uppercase">Total aportes</div>
              <div className="text-xl font-black text-duo-blue">{state.goalContributions.length}</div>
            </div>
            <div className="card-3d text-center py-2.5">
              <div className="text-[10px] font-bold text-[#5C7680] uppercase">Metas completas</div>
              <div className="text-xl font-black text-duo-green">
                {state.goals.filter(g => g.currentAmount >= g.targetAmount).length}/{state.goals.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Logros === */}
      <div>
        <h2 className="text-[13px] font-extrabold text-[#94A7B0] uppercase tracking-wider mb-1">Logros</h2>
        <p className="text-[11px] font-bold text-[#5C7680] mb-2.5">
          {unlockedCount} de {state.achievements.length} desbloqueados
        </p>

        <div className="progress-bar-track !h-2.5 mb-3">
          <motion.div
            className="progress-bar-fill bg-gradient-to-r from-duo-yellow to-duo-orange"
            animate={{ width: `${Math.max((unlockedCount / state.achievements.length) * 100, 2)}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {state.achievements.map(achievement => {
            const isUnlocked = !!achievement.unlockedAt
            return (
              <div
                key={achievement.id}
                className={`card-3d text-center !py-3 !px-2.5 ${
                  isUnlocked
                    ? '!border-duo-yellow !shadow-[0_2px_0_#E58700]'
                    : 'opacity-40'
                }`}
              >
                <div className={`text-3xl mb-1.5 ${isUnlocked ? '' : 'grayscale'}`}>
                  {achievement.icon}
                </div>
                <div className={`text-[12px] font-black mb-0.5 ${isUnlocked ? 'text-white' : 'text-[#5C7680]'}`}>
                  {achievement.name}
                </div>
                <div className={`text-[10px] font-bold leading-snug ${isUnlocked ? 'text-[#94A7B0]' : 'text-[#3C5564]'}`}>
                  {achievement.description}
                </div>
                {isUnlocked && (
                  <div className="mt-1 text-[9px] font-bold text-duo-yellow">
                    {new Date(achievement.unlockedAt!).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                  </div>
                )}
                {!isUnlocked && <div className="mt-1 text-[13px]">🔒</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: string }) {
  return (
    <div className="card-3d text-center py-3">
      <div className="text-xl mb-0.5">{icon}</div>
      <div className="text-[10px] font-bold text-[#5C7680] uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] font-bold text-[#5C7680]">{sub}</div>
    </div>
  )
}
