import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XPRing } from '../components/XPRing'
import { LevelBar } from '../components/LevelBar'
import { HabitCard } from '../components/HabitCard'
import { BottomSheet, FormInput } from '../components/FormModal'
import type { AppState, Habit, HabitType } from '../types'
import { dailyXP, calculateGlobalStreak, today, isPerfectDay } from '../lib/streaks'
import { currentWeekXP, getWeeklyTier, bestWeekXP } from '../lib/streaks'
import { LEAGUE_NAMES, LEAGUE_COLORS } from '../lib/gameConfig'

const ICONS = ['💪', '🏃', '🥗', '💧', '📚', '🧘', '💤', '✍️', '🏋️', '🚴', '🧠', '❤️', '🌱', '🎵']
const COLORS = ['#58CC02', '#1CB0F6', '#FF9600', '#FF4B4B', '#CE82FF', '#FFC800']

interface TodayScreenProps {
  state: AppState
  onToggle: (id: string) => void
  onUpdateQuant: (id: string, value: number) => void
  onAddHabit: (h: Omit<Habit, 'id' | 'createdAt'>) => void
  onUpdateHabit: (id: string, data: Partial<Habit>) => void
  onDeleteHabit: (id: string) => void
}

export function TodayScreen({ state, onToggle, onUpdateQuant, onAddHabit, onUpdateHabit, onDeleteHabit }: TodayScreenProps) {
  const todayStr = today()
  const todayXP = dailyXP(state.habitLogs, state.habits, todayStr)
  const { streak } = calculateGlobalStreak(state.habitLogs, state.habits, state.profile)
  const perfectDay = isPerfectDay(state.habitLogs, state.habits, todayStr)
  const weekXP = currentWeekXP(state.habitLogs, state.habits)
  const tier = getWeeklyTier(weekXP)
  const best = bestWeekXP(state.weeklyLeagues)

  const completedCount = state.habits.filter(h =>
    state.habitLogs.some(l => l.habitId === h.id && l.date === todayStr && l.completed)
  ).length

  // --- Form state ---
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', icon: '💪', type: 'binary' as HabitType, target: '', unit: '', color: COLORS[0], xpReward: 10 })

  const openNew = () => {
    setForm({ name: '', icon: '💪', type: 'binary', target: '', unit: '', color: COLORS[0], xpReward: 10 })
    setEditingId(null)
    setShowForm(true)
  }
  const openEdit = (h: Habit) => {
    setForm({ name: h.name, icon: h.icon, type: h.type, target: h.target?.toString() ?? '', unit: h.unit ?? '', color: h.color, xpReward: h.xpReward })
    setEditingId(h.id)
    setShowForm(true)
  }
  const handleSave = () => {
    if (!form.name.trim()) return
    const data = {
      name: form.name.trim(), icon: form.icon, type: form.type,
      target: form.type === 'quant' ? parseFloat(form.target) || 0 : undefined,
      unit: form.type === 'quant' ? form.unit : undefined,
      color: form.color, xpReward: form.xpReward,
    }
    if (editingId) onUpdateHabit(editingId, data)
    else onAddHabit(data)
    setShowForm(false)
  }
  const handleDelete = () => {
    if (editingId && confirm('Eliminar este habito y todo su historial?')) {
      onDeleteHabit(editingId)
      setShowForm(false)
    }
  }

  return (
    <div className="px-4 pt-2 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-white leading-tight">HabitQuest</h1>
          <p className="text-[#5C7680] text-[13px] font-bold capitalize">
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div
          className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border-2"
          style={{
            backgroundColor: LEAGUE_COLORS[tier] + '20',
            color: LEAGUE_COLORS[tier],
            borderColor: LEAGUE_COLORS[tier] + '50',
          }}
        >
          {LEAGUE_NAMES[tier]}
        </div>
      </div>

      {/* XP Ring + Stats */}
      <div className="flex flex-col items-center gap-3 mb-5">
        <XPRing current={todayXP} target={state.profile.dailyXPGoal} size={160} strokeWidth={14} />

        <div className="flex items-center gap-2.5">
          <div className={`badge-streak ${streak === 0 ? 'opacity-40' : ''}`}>
            <span>🔥</span><span>{streak}</span>
          </div>
          <div className="badge-freeze">
            <span>🧊</span><span>{state.profile.streakFreezes}</span>
          </div>
          <div className="badge-xp">
            <span>💎</span><span>{state.profile.totalXP}</span>
          </div>
        </div>

        <p className="text-[11px] font-bold text-[#5C7680]">
          Semana: {weekXP} XP{best > 0 && ` · Mejor: ${best} XP`}
        </p>

        {perfectDay && state.habits.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-3 py-1.5 rounded-full bg-[rgba(88,204,2,0.12)] border-2 border-duo-green text-duo-green text-[12px] font-black uppercase tracking-wider"
          >
            Dia Perfecto
          </motion.div>
        )}
      </div>

      {/* Level bar */}
      <div className="mb-5">
        <LevelBar totalXP={state.profile.totalXP} />
      </div>

      {/* --- Hábitos del día --- */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-extrabold text-[#94A7B0] uppercase tracking-wider">
          Habitos de hoy
        </h2>
        {state.habits.length > 0 && (
          <span className="text-[13px] font-bold text-[#5C7680]">
            {completedCount}/{state.habits.length}
          </span>
        )}
      </div>

      {state.habits.length === 0 ? (
        /* --- Empty state explicativo --- */
        <div className="card-3d text-center py-8 px-5">
          <div className="text-4xl mb-3">⚡</div>
          <h3 className="text-[17px] font-black text-white mb-2">Crea tu primer habito</h3>
          <p className="text-[13px] font-bold text-[#94A7B0] leading-relaxed mb-1">
            Los habitos son acciones que repites cada dia.
          </p>
          <p className="text-[13px] font-bold text-[#5C7680] leading-relaxed mb-5">
            Pueden ser de tipo Si/No (como "fui al gym") o cuantitativos (como "beber 2L de agua"). Cada uno que completes te da XP.
          </p>
          <button onClick={openNew} className="btn-3d w-full !text-[14px]">
            + Crear habito
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {state.habits.map(habit => {
            const log = state.habitLogs.find(l => l.habitId === habit.id && l.date === todayStr)
            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                log={log}
                onToggle={onToggle}
                onUpdateQuant={onUpdateQuant}
                onLongPress={() => openEdit(habit)}
              />
            )
          })}

          {/* Botón agregar más */}
          <button
            onClick={openNew}
            className="w-full h-12 rounded-2xl border-2 border-dashed border-surface-500 text-[#5C7680] font-bold text-[14px] flex items-center justify-center gap-2 active:bg-surface-700 transition-colors"
          >
            + Agregar habito
          </button>
        </div>
      )}

      {/* --- Form modal --- */}
      <BottomSheet open={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar habito' : 'Nuevo habito'}>
        <div className="space-y-4">
          <FormInput label="Nombre" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Ej: Ir al gym" autoFocus />

          {/* Tipo */}
          <div>
            <label className="text-[11px] font-bold text-[#5C7680] uppercase tracking-wider mb-1.5 block">Tipo</label>
            <div className="flex gap-2">
              {(['binary', 'quant'] as HabitType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setForm({ ...form, type })}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-black border-2 transition-all duration-100 ${
                    form.type === type
                      ? 'bg-duo-green border-duo-green-dark shadow-[0_3px_0_#43C000] text-white'
                      : 'bg-surface-700 border-surface-500 shadow-[0_3px_0_var(--color-surface-600)] text-[#94A7B0]'
                  } active:shadow-none active:translate-y-[3px]`}
                >
                  {type === 'binary' ? 'Si / No' : 'Cuantitativo'}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-bold text-[#5C7680] mt-1.5">
              {form.type === 'binary'
                ? 'Un tap para marcar como hecho. Ej: "Fui al gym", "Comi sano".'
                : 'Registras un numero y tiene un objetivo. Ej: "10,000 pasos", "2L de agua".'
              }
            </p>
          </div>

          {/* Quant fields */}
          <AnimatePresence>
            {form.type === 'quant' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2">
                  <FormInput label="Meta diaria" value={form.target} onChange={v => setForm({ ...form, target: v })} placeholder="10000" type="number" className="flex-1" />
                  <FormInput label="Unidad" value={form.unit} onChange={v => setForm({ ...form, unit: v })} placeholder="pasos" className="w-24" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Icono */}
          <div>
            <label className="text-[11px] font-bold text-[#5C7680] uppercase tracking-wider mb-1.5 block">Icono</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setForm({ ...form, icon })}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border-2 transition-all ${
                    form.icon === icon ? 'bg-duo-blue/20 border-duo-blue' : 'bg-surface-700 border-surface-600'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-[11px] font-bold text-[#5C7680] uppercase tracking-wider mb-1.5 block">Color</label>
            <div className="flex gap-2">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setForm({ ...form, color })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    form.color === color ? 'scale-110 border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <button onClick={handleSave} className="btn-3d w-full !h-12 !text-[14px]">
            {editingId ? 'Guardar cambios' : 'Crear habito'}
          </button>

          {editingId && (
            <button onClick={handleDelete} className="w-full h-10 text-duo-red font-bold text-[13px]">
              Eliminar habito
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
