import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BottomSheet, FormInput } from '../components/FormModal'
import type { AppState, Goal } from '../types'
import { GAME_CONFIG } from '../lib/gameConfig'

const ICONS = ['💰', '📈', '🏠', '🚗', '✈️', '🎓', '💻', '🏋️', '📚', '🎯', '❤️', '🌱']

interface GoalsScreenProps {
  state: AppState
  onAddContribution: (goalId: string, amount: number, note?: string) => void
  onAddGoal: (g: Omit<Goal, 'id' | 'currentAmount'>) => void
  onUpdateGoal: (id: string, data: Partial<Goal>) => void
  onDeleteGoal: (id: string) => void
}

// Mensaje motivacional según el porcentaje
function getMotivation(percent: number): string {
  if (percent >= 100) return 'Meta cumplida!'
  if (percent >= 75) return 'Ya casi! El ultimo tramo es el mas importante.'
  if (percent >= 50) return 'Mas de la mitad! Vas con todo.'
  if (percent >= 25) return 'Buen progreso, sigue sumando.'
  if (percent > 0) return 'El primer paso esta dado. Cada aporte cuenta.'
  return 'Registra tu primer aporte para arrancar.'
}

export function GoalsScreen({ state, onAddContribution, onAddGoal, onUpdateGoal, onDeleteGoal }: GoalsScreenProps) {
  const [contrib, setContrib] = useState<{ goalId: string; goalName: string; amount: string; note: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', icon: '💰', targetAmount: '', unit: '', deadline: '' })

  const openNew = () => {
    setForm({ name: '', icon: '💰', targetAmount: '', unit: '', deadline: '' })
    setEditingId(null)
    setShowForm(true)
  }
  const openEdit = (g: Goal) => {
    setForm({ name: g.name, icon: g.icon, targetAmount: g.targetAmount.toString(), unit: g.unit, deadline: g.deadline ?? '' })
    setEditingId(g.id)
    setShowForm(true)
  }
  const handleSaveGoal = () => {
    if (!form.name.trim() || !form.targetAmount) return
    const data = {
      name: form.name.trim(), icon: form.icon,
      targetAmount: parseFloat(form.targetAmount) || 0,
      unit: form.unit,
      deadline: form.deadline || undefined,
    }
    if (editingId) onUpdateGoal(editingId, data)
    else onAddGoal(data)
    setShowForm(false)
  }
  const handleDeleteGoal = () => {
    if (editingId && confirm('Eliminar esta meta y todos sus aportes?')) {
      onDeleteGoal(editingId)
      setShowForm(false)
    }
  }

  const handleSubmitContrib = () => {
    if (!contrib) return
    const amount = parseFloat(contrib.amount)
    if (isNaN(amount) || amount <= 0) return
    onAddContribution(contrib.goalId, amount, contrib.note || undefined)
    setContrib(null)
  }

  return (
    <div className="px-4 pt-2 pb-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-black text-white leading-tight">Metas</h1>
        {state.goals.length > 0 && (
          <span className="text-[12px] font-bold text-[#5C7680]">
            {state.goals.filter(g => g.currentAmount >= g.targetAmount).length}/{state.goals.length} completadas
          </span>
        )}
      </div>
      <p className="text-[13px] font-bold text-[#5C7680] mb-4">
        Objetivos a largo plazo. Cada aporte te da +{GAME_CONFIG.xp.goalContribution} XP.
      </p>

      {state.goals.length === 0 ? (
        <div className="card-3d text-center py-8 px-5">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-[17px] font-black text-white mb-2">Crea tu primera meta</h3>
          <p className="text-[13px] font-bold text-[#94A7B0] leading-relaxed mb-1">
            Las metas son objetivos progresivos que no se reinician cada dia.
          </p>
          <p className="text-[13px] font-bold text-[#5C7680] leading-relaxed mb-5">
            Puede ser cualquier cosa: ahorrar S/5000, leer 24 libros, correr 500km. Vas registrando aportes y cada uno te da +{GAME_CONFIG.xp.goalContribution} XP.
          </p>
          <button onClick={openNew} className="btn-3d btn-3d-blue w-full !text-[14px]">
            + Crear meta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {state.goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              contributions={state.goalContributions.filter(c => c.goalId === goal.id)}
              onAddContrib={() => setContrib({ goalId: goal.id, goalName: goal.name, amount: '', note: '' })}
              onEdit={() => openEdit(goal)}
            />
          ))}
          <button
            onClick={openNew}
            className="w-full h-12 rounded-2xl border-2 border-dashed border-surface-500 text-[#5C7680] font-bold text-[14px] flex items-center justify-center gap-2 active:bg-surface-700 transition-colors"
          >
            + Agregar meta
          </button>
        </div>
      )}

      {/* --- Contribution modal --- */}
      <BottomSheet open={!!contrib} onClose={() => setContrib(null)} title="Registrar aporte">
        <div className="space-y-4">
          {contrib && (
            <div className="bg-surface-700 rounded-xl px-3 py-2 text-[13px] font-bold text-[#94A7B0] flex items-center justify-between">
              <span>{contrib.goalName}</span>
              <span className="text-duo-yellow text-[12px]">+{GAME_CONFIG.xp.goalContribution} XP</span>
            </div>
          )}
          <FormInput label="Monto" value={contrib?.amount ?? ''} onChange={v => contrib && setContrib({ ...contrib, amount: v })} placeholder="0.00" type="number" autoFocus />
          <FormInput label="Nota (opcional)" value={contrib?.note ?? ''} onChange={v => contrib && setContrib({ ...contrib, note: v })} placeholder="Ej: salario mayo" />
          <button onClick={handleSubmitContrib} className="btn-3d w-full !h-12 !text-[14px]">
            Agregar aporte
          </button>
        </div>
      </BottomSheet>

      {/* --- Goal form modal --- */}
      <BottomSheet open={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar meta' : 'Nueva meta'}>
        <div className="space-y-4">
          <FormInput label="Nombre" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Ej: Fondo de emergencia" autoFocus />

          <div>
            <label className="text-[11px] font-bold text-[#5C7680] uppercase tracking-wider mb-1.5 block">Icono</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(icon => (
                <button key={icon} onClick={() => setForm({ ...form, icon })}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border-2 transition-all ${
                    form.icon === icon ? 'bg-duo-blue/20 border-duo-blue' : 'bg-surface-700 border-surface-600'
                  }`}
                >{icon}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <FormInput label="Objetivo" value={form.targetAmount} onChange={v => setForm({ ...form, targetAmount: v })} placeholder="5000" type="number" className="flex-1" />
            <FormInput label="Unidad" value={form.unit} onChange={v => setForm({ ...form, unit: v })} placeholder="S/, km, libros..." className="flex-1" />
          </div>

          <FormInput label="Fecha limite (opcional)" value={form.deadline} onChange={v => setForm({ ...form, deadline: v })} type="date" />

          <button onClick={handleSaveGoal} className="btn-3d btn-3d-blue w-full !h-12 !text-[14px]">
            {editingId ? 'Guardar cambios' : 'Crear meta'}
          </button>

          {editingId && (
            <button onClick={handleDeleteGoal} className="w-full h-10 text-duo-red font-bold text-[13px]">
              Eliminar meta
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}

// === Goal Card con milestones y motivación ===
function GoalCard({ goal, contributions, onAddContrib, onEdit }: {
  goal: Goal
  contributions: { date: string; amount: number; note?: string }[]
  onAddContrib: () => void
  onEdit: () => void
}) {
  const [showLog, setShowLog] = useState(false)
  const percent = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0
  const isComplete = percent >= 100

  const progressColor = isComplete
    ? 'bg-gradient-to-r from-duo-green to-duo-green-light'
    : percent >= 50
      ? 'bg-gradient-to-r from-duo-yellow to-duo-green'
      : 'bg-gradient-to-r from-duo-blue to-duo-purple'

  const milestones = [25, 50, 75]

  return (
    <div className={`card-3d ${isComplete ? '!border-duo-green !shadow-[0_2px_0_#43C000]' : ''}`}>
      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-3xl">{goal.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className={`font-extrabold text-[15px] truncate ${isComplete ? 'text-duo-green' : 'text-white'}`}>
            {goal.name}
          </h3>
          {goal.deadline && (
            <p className="text-[11px] font-bold text-[#5C7680]">
              Limite: {new Date(goal.deadline).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className={`min-w-[46px] h-[46px] rounded-xl flex flex-col items-center justify-center border-2 ${
          isComplete ? 'bg-[rgba(88,204,2,0.12)] border-duo-green' : 'bg-surface-700 border-surface-500'
        }`}>
          <span className={`text-[17px] font-black leading-none ${isComplete ? 'text-duo-green' : 'text-white'}`}>
            {Math.round(percent)}
          </span>
          <span className="text-[9px] font-bold text-[#5C7680]">%</span>
        </div>
      </div>

      {/* Progress bar con milestone markers */}
      <div className="relative mb-1.5">
        <div className="progress-bar-track !h-3.5">
          <motion.div
            className={`progress-bar-fill ${progressColor}`}
            animate={{ width: `${Math.max(percent, 1)}%` }}
            transition={{ duration: 0.5, ease: [0.3, 0.7, 0.4, 1] }}
          />
        </div>
        {/* Milestone dots */}
        {milestones.map(m => (
          <div
            key={m}
            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 ${
              percent >= m
                ? 'bg-white border-white'
                : 'bg-surface-600 border-surface-500'
            }`}
            style={{ left: `${m}%`, marginLeft: -5 }}
          />
        ))}
      </div>

      <div className="flex justify-between text-[11px] font-bold text-[#5C7680] mb-2">
        <span>{goal.currentAmount.toLocaleString()} {goal.unit}</span>
        <span>{goal.targetAmount.toLocaleString()} {goal.unit}</span>
      </div>

      {/* Mensaje motivacional */}
      <p className="text-[12px] font-bold text-[#94A7B0] mb-3 italic">
        {getMotivation(percent)}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {isComplete ? (
          <div className="flex-1 h-11 rounded-xl bg-[rgba(88,204,2,0.1)] border-2 border-duo-green flex items-center justify-center gap-1.5 text-duo-green font-black text-[13px]">
            Meta completada
          </div>
        ) : (
          <button onClick={onAddContrib} className="btn-3d flex-1 !h-11 !text-[13px]">
            + Aporte (+{GAME_CONFIG.xp.goalContribution} XP)
          </button>
        )}
        <button
          onClick={onEdit}
          className="h-11 px-3 rounded-xl bg-surface-700 border-2 border-surface-500 shadow-[0_3px_0_var(--color-surface-600)] text-[#94A7B0] text-[12px] font-bold active:shadow-none active:translate-y-[3px] transition-all duration-100"
        >
          Editar
        </button>
        {contributions.length > 0 && (
          <button
            onClick={() => setShowLog(!showLog)}
            className="h-11 px-3 rounded-xl bg-surface-700 border-2 border-surface-500 shadow-[0_3px_0_var(--color-surface-600)] text-[#94A7B0] text-[12px] font-bold active:shadow-none active:translate-y-[3px] transition-all duration-100"
          >
            {showLog ? 'Ocultar' : `${contributions.length}`}
          </button>
        )}
      </div>

      {/* Log */}
      <AnimatePresence>
        {showLog && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-1 max-h-36 overflow-y-auto">
              {contributions.slice().reverse().map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[12px] font-bold py-1.5 px-2.5 rounded-lg bg-surface-700/50">
                  <span className="text-[#5C7680]">{c.date}</span>
                  <span className="text-duo-green">+{c.amount.toLocaleString()} {goal.unit}</span>
                  {c.note && <span className="text-[#5C7680] truncate ml-2 max-w-[80px]">{c.note}</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
