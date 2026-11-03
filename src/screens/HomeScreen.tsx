import { useState } from 'react'
import type { AppController } from '../hooks/useAppState'
import type { Goal } from '../types'
import {
  daysBetween, getRecord, goalStatus, lastNDates, latestWeigh, nearestGoal, shortDate, uid,
} from '../lib/logic'
import { WEIGHT_CHART_DAYS } from '../lib/config'
import { BottomSheet, ConfirmButton, MonoInput, Stepper, Toast, WeightWheel } from '../components/ui'
import { LineChart } from '../components/charts'

const fmt = (n: number, d = 1) => n.toFixed(d).replace('.', ',')

/** Una linea que dice, sin adornos, como vas contra el ritmo que necesitas. */
function paceLine(s: ReturnType<typeof goalStatus>): { text: string; tone: 'good' | 'warn' | 'bad' | 'mute' } {
  if (s.current == null) return { text: 'Pésate hoy para saber dónde estás parado.', tone: 'mute' }
  if (s.remaining != null && s.remaining <= 0) {
    return { text: 'Ya estás en el peso de la meta. Ahora no lo sueltes.', tone: 'good' }
  }
  if (s.daysLeft <= 0) return { text: 'Se acabó el tiempo.', tone: 'bad' }
  const need = s.neededPerWeek as number
  if (s.actualPerWeek == null) {
    return { text: `Necesitas bajar ${fmt(need, 2)} kg por semana. Falta data para ver tu ritmo.`, tone: 'mute' }
  }
  const lose = -s.actualPerWeek
  if (lose >= need) return { text: `Vas a ${fmt(lose)} kg/sem y necesitas ${fmt(need, 2)}. Sigue así.`, tone: 'good' }
  if (lose > 0) return { text: `Vas a ${fmt(lose)} kg/sem y necesitas ${fmt(need, 2)}. Estás corto.`, tone: 'warn' }
  return { text: `Necesitas bajar ${fmt(need, 2)} kg/sem y tu peso no está bajando.`, tone: 'bad' }
}

export function HomeScreen({ app }: { app: AppController }) {
  const { state, today } = app
  const { goals } = state.settings
  const [weightOpen, setWeightOpen] = useState(false)
  const [goalEditor, setGoalEditor] = useState<Goal | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const goal = nearestGoal(goals, today)
  const status = goal ? goalStatus(state.records, goal, today) : null
  const pace = status ? paceLine(status) : null

  const todayWeight = getRecord(state.records, today)?.weight
  const last = latestWeigh(state.records, today)
  const points = lastNDates(WEIGHT_CHART_DAYS, today).map(date => ({
    date, value: getRecord(state.records, date)?.weight ?? null,
  }))

  const newGoal = (): Goal => ({ id: uid('g'), name: '', date: today, targetWeight: last ? Math.max(30, Math.round(last.weight) - 5) : 80 })

  return (
    <>
      {goal && status ? (
        <section className="mx-hero" aria-label="Cuenta regresiva">
          <div className="mx-eyebrow">{goal.name} · {shortDate(goal.date)}</div>
          <div className="mx-hero-n mx-mono">{Math.max(0, status.daysLeft)}</div>
          <div className="mx-hero-u">
            {status.daysLeft === 0 ? 'es hoy' : status.daysLeft === 1 ? 'día' : 'días'}
          </div>
          <p className="mx-hero-tag">
            {status.daysLeft > 1
              ? `Mañana serán ${status.daysLeft - 1}. Ese día no vuelve.`
              : status.daysLeft === 1
                ? 'Mañana es el día.'
                : 'Hoy se juega.'}
          </p>
          <div className="mx-hero-grid">
            <div><small>Ahora</small><b className="mx-mono">{status.current != null ? `${fmt(status.current)} kg` : '—'}</b></div>
            <div><small>Meta</small><b className="mx-mono">{fmt(goal.targetWeight)} kg</b></div>
            <div>
              <small>{status.remaining != null && status.remaining < 0 ? 'Pasado' : 'Faltan'}</small>
              <b className="mx-mono">{status.remaining != null ? `${fmt(Math.abs(status.remaining))} kg` : '—'}</b>
            </div>
          </div>
          {pace && <div className="mx-hero-pace" data-tone={pace.tone}>{pace.text}</div>}
        </section>
      ) : (
        <section className="mx-hero" aria-label="Sin meta">
          <div className="mx-eyebrow">Sin meta próxima</div>
          <p className="mx-hero-tag" style={{ marginTop: 10 }}>
            {goals.length === 0
              ? 'Sin fecha no hay presión. Pon el evento y el peso al que quieres llegar.'
              : 'Las metas que tenías ya pasaron. Pon la siguiente.'}
          </p>
          <button className="mx-btn" data-p="1" style={{ width: '100%', marginTop: 14 }} onClick={() => setGoalEditor(newGoal())}>
            Agregar meta
          </button>
        </section>
      )}

      <button className="mx-weigh" data-done={todayWeight != null ? '1' : '0'} onClick={() => setWeightOpen(true)}>
        <span>
          <small>{todayWeight != null ? 'Peso de hoy' : 'Falta pesarte hoy'}</small>
          <b className="mx-mono">{todayWeight != null ? `${fmt(todayWeight)} kg` : 'Registrar peso'}</b>
        </span>
        <i aria-hidden>{todayWeight != null ? '✎' : '→'}</i>
      </button>

      <div className="mx-card">
        <div className="mx-card-t">
          <div className="mx-eyebrow">Peso · últimos {WEIGHT_CHART_DAYS} días</div>
          {goal && <div className="mx-mono" style={{ fontSize: 12, fontWeight: 600 }}>meta {fmt(goal.targetWeight)} kg</div>}
        </div>
        <LineChart points={points} unit="kg" height={130} band={goal?.targetWeight} />
        {goal && <div className="mx-legend">La línea punteada es el peso de tu meta.</div>}
      </div>

      <div className="mx-card">
        <div className="mx-card-t">
          <div className="mx-eyebrow">Metas</div>
        </div>
        {goals.length === 0 && <div className="mx-empty">Todavía no tienes metas.</div>}
        {goals.map(g => {
          const left = daysBetween(today, g.date)
          return (
            <div key={g.id} className="mx-row" data-past={left < 0 ? '1' : '0'}>
              <div style={{ flex: 1 }}>
                <div className="mx-lbl">{g.name}</div>
                <div className="mx-sub mx-mono">
                  {fmt(g.targetWeight)} kg · {shortDate(g.date)} · {left < 0 ? 'pasó' : left === 0 ? 'hoy' : `${left} d`}
                </div>
              </div>
              <button className="mx-mini" onClick={() => setGoalEditor({ ...g })}>Editar</button>
            </div>
          )
        })}
        <button className="mx-add" onClick={() => setGoalEditor(newGoal())}>+ Agregar meta</button>
      </div>

      <WeightWheel
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        title="Peso en ayunas"
        initialKg={todayWeight ?? last?.weight ?? 80}
        hasValue={todayWeight != null}
        onChange={v => { app.setWeight(v, today); setToast(v == null ? 'Peso borrado' : `${fmt(v)} kg guardado`) }}
      />

      {goalEditor && (
        <GoalEditorSheet
          goal={goalEditor}
          existing={goals.some(g => g.id === goalEditor.id)}
          onChange={setGoalEditor}
          onClose={() => setGoalEditor(null)}
          onSave={g => { app.upsertGoal(g); setGoalEditor(null); setToast('Meta guardada') }}
          onDelete={id => { app.removeGoal(id); setGoalEditor(null); setToast('Meta eliminada') }}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  )
}

function GoalEditorSheet({ goal, existing, onChange, onClose, onSave, onDelete }: {
  goal: Goal
  existing: boolean
  onChange: (g: Goal) => void
  onClose: () => void
  onSave: (g: Goal) => void
  onDelete: (id: string) => void
}) {
  const valid = goal.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(goal.date) && goal.targetWeight > 0

  return (
    <BottomSheet open onClose={onClose} title={existing ? 'Editar meta' : 'Nueva meta'} wide>
      <div className="mx-lbl" style={{ marginBottom: 4 }}>Nombre del evento</div>
      <MonoInput value={goal.name} onChange={v => onChange({ ...goal, name: v })} placeholder="Ej: Boda Lucia" className="mx-in-full" />

      <div className="mx-row" style={{ marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="mx-lbl">Fecha</div>
          <div className="mx-sub">La cuenta regresiva apunta a la más próxima</div>
        </div>
        <input
          className="mx-in mx-date"
          type="date"
          value={goal.date}
          onChange={e => onChange({ ...goal, date: e.target.value })}
        />
      </div>

      <div className="mx-row" style={{ marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="mx-lbl">Peso objetivo</div>
          <div className="mx-sub">A dónde quieres llegar ese día</div>
        </div>
        <Stepper
          value={goal.targetWeight}
          onChange={v => onChange({ ...goal, targetWeight: Math.max(30, v) })}
          step={0.5}
          min={30}
          suffix="kg"
        />
      </div>

      <div className="mx-acts">
        <button
          className="mx-btn" data-p="1" disabled={!valid}
          onClick={() => onSave({ ...goal, name: goal.name.trim() })}
        >
          Guardar
        </button>
        {existing && <ConfirmButton label="Eliminar meta" confirmLabel="Confirmar" onConfirm={() => onDelete(goal.id)} />}
        <button className="mx-btn" onClick={onClose}>Cancelar</button>
      </div>
    </BottomSheet>
  )
}
