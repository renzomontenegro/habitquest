import { useState } from 'react'
import type { AppController } from '../hooks/useAppState'
import type { MealLog, MealSlot } from '../types'
import {
  addDays, dayMacros, daysBetween, foodLogCoverage, getRecord, headerDate, kcal, lastNDates, lastSessionWeight,
  makeEmptySets, mealMacros, mealName, mealsInSlot, nearestWeight, parseDate, roundMacros, shortDate, sleepHours,
  slotReference, weightAvg, weightTrendAt, workoutForDate,
} from '../lib/logic'
import { MACRO_LABEL, PORTIONS, SLOTS, SLOT_LABEL } from '../lib/config'
import { MealEstimateSheet } from '../components/MealEstimateSheet'
import { MealIdeaSheet } from '../components/MealIdeaSheet'
import { MacroPie } from '../components/charts'
import { WeekScreen } from './WeekScreen'
import { BottomSheet, ConfirmButton, Field, RepsWheel, Seg, Stepper, TimeWheel, Toast, WeightWheel } from '../components/ui'

function portionLabel(p: number): string {
  if (p === 0.5) return '½'
  if (p === 1.5) return '1½'
  return String(p)
}

type Sec = 'sueno' | 'peso' | 'entreno' | 'comidas' | 'actividad'

/** Progreso 0-1 de una categoria: lo que esta lleno del dia. */
function secProgress(sec: Sec, record: ReturnType<typeof getRecord>, workout: ReturnType<typeof workoutForDate>): number {
  switch (sec) {
    case 'sueno': {
      const s = (record?.bedTime ? 1 : 0) + (record?.wakeTime ? 1 : 0)
      return s === 0 ? 0 : s === 1 ? 0.5 : 1
    }
    case 'peso':
      return record?.weight != null ? 1 : 0
    case 'entreno': {
      if (record?.workoutId === null) return 1 // descanso explicito
      if (!workout || workout.exercises.length === 0) return 0
      const total = workout.exercises.reduce((n, ex) => n + ex.sets, 0)
      const filled = Object.values(record?.sets ?? {}).reduce((n, list) => n + list.length, 0)
      return total > 0 ? Math.min(1, filled / total) : 0
    }
    case 'comidas': {
      const covered = SLOTS.filter(s =>
        mealsInSlot(record, s.id).length > 0 || (record?.skipped ?? []).includes(s.id)).length
      return covered / SLOTS.length
    }
    case 'actividad':
      return record?.steps != null ? 1 : 0
  }
}

const SECS: { id: Sec; label: string; color: string }[] = [
  { id: 'sueno', label: 'Sueno', color: 'var(--warn)' },
  { id: 'peso', label: 'Peso', color: 'var(--good)' },
  { id: 'entreno', label: 'Entrenamiento', color: 'var(--ink)' },
  { id: 'comidas', label: 'Comidas', color: 'var(--signal)' },
  { id: 'actividad', label: 'Actividad', color: 'var(--mute)' },
]

const SECTION_ICON_PATHS: Record<Sec, string[]> = {
  comidas: ['M4 3v8a2 2 0 0 0 2 2h1V3', 'M5.5 3v10', 'M18 3v18', 'M18 3c-3 2-4 5-4 8h4', 'M7 13v8'],
  entreno: ['M6 7v10', 'M18 7v10', 'M3 9v6', 'M21 9v6', 'M6 12h12'],
  peso: ['M5 5h14l2 16H3L5 5Z', 'M9 9a3 3 0 0 1 6 0', 'M12 9l2-2'],
  actividad: ['M13 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M7 22l3-7 2 2v5', 'M18 22l-3-9-4-3 2-3 3 3 4 1'],
  sueno: ['M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z'],
}

function SectionIcon({ id }: { id: Sec }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {SECTION_ICON_PATHS[id].map((d, i) => <path d={d} key={i} />)}
    </svg>
  )
}

export function TodayScreen({ app, viewDate, setViewDate, goToday }: {
  app: AppController
  viewDate: string
  setViewDate: (d: string) => void
  goToday: () => void
}) {
  const { state, today } = app
  const { split, targets, sleepTarget, stepsTarget } = state.settings

  const record = getRecord(state.records, viewDate)
  const eaten = dayMacros(record)
  const slept = sleepHours(record?.bedTime, record?.wakeTime)
  const previousSleepTime = (field: 'bedTime' | 'wakeTime'): string | undefined => {
    for (let i = 1; i <= 30; i++) {
      const value = getRecord(state.records, addDays(viewDate, -i))?.[field]
      if (value) return value
    }
    return undefined
  }
  const previousBedTime = previousSleepTime('bedTime')
  const previousWakeTime = previousSleepTime('wakeTime')

  const [estimating, setEstimating] = useState<MealSlot | null>(null)
  const [ideaSlot, setIdeaSlot] = useState<MealSlot | null>(null)
  const [editing, setEditing] = useState<MealLog | null>(null)
  const [sleepPicker, setSleepPicker] = useState<null | 'bed' | 'wake'>(null)
  const [weightPicker, setWeightPicker] = useState(false)
  const [exWheel, setExWheel] = useState<null | { exId: string; index: number }>(null)
  const [repsWheel, setRepsWheel] = useState<null | { exId: string; index: number }>(null)
  const [openSec, setOpenSec] = useState<Sec | null>(null)
  const [goalEditor, setGoalEditor] = useState(false)
  const [closingDay, setClosingDay] = useState(false)
  const [measureField, setMeasureField] = useState<'steps' | 'waist' | null>(null)
  const [measureDraft, setMeasureDraft] = useState('')
  const [measureError, setMeasureError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const workout = workoutForDate(record, split, viewDate)
  const weightStart = record?.weight ?? nearestWeight(state.records, viewDate) ?? 100
  const eatenKcal = kcal(eaten)
  const targetKcal = kcal(targets)
  const kcalLeft = targetKcal - eatenKcal
  const foodCoverage = foodLogCoverage(record)
  const missingSlots = SLOTS.filter(s =>
    mealsInSlot(record, s.id).length === 0 && !(record?.skipped ?? []).includes(s.id),
  )
  const preferredSlot: MealSlot = (() => {
    const hour = viewDate === today ? new Date().getHours() : 12
    const preferred: MealSlot = hour < 11 ? 'desayuno' : hour < 17 ? 'almuerzo' : 'cena'
    if (missingSlots.some(s => s.id === preferred)) return preferred
    return missingSlots.find(s => s.id !== 'extra')?.id ?? missingSlots[0]?.id ?? 'extra'
  })()
  const avg7 = weightAvg(state.records, addDays(viewDate, -6), viewDate)
  const goalDays = state.settings.targetDate ? daysBetween(viewDate, state.settings.targetDate) : null
  const goalWeight = state.settings.targetWeight
  const goalLeft = avg7 != null && goalWeight != null ? Math.max(0, avg7 - goalWeight) : null
  const requiredPerWeek = goalLeft != null && goalDays != null && goalDays > 0
    ? goalLeft / (goalDays / 7)
    : null
  const actualTrend = weightTrendAt(state.records, viewDate)?.delta ?? null
  const projectedGoalWeight = avg7 != null && actualTrend != null && goalDays != null && goalDays > 0
    ? avg7 + actualTrend * (goalDays / 7)
    : null
  const recentWaist = state.records
    .filter(r => r.waist != null && r.date <= viewDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const waistDue = !recentWaist || daysBetween(recentWaist.date, viewDate) >= 7

  // Peso al que arranca el wheel de una serie: lo ya cargado, si no el ultimo
  // entreno del ejercicio, si no 50 (caso de un dia nuevo sin historial).
  const exInitial = (() => {
    if (!exWheel) return 0
    const own = record?.sets?.[exWheel.exId]?.[exWheel.index]?.weight
    if (own) return parseFloat(own)
    return lastSessionWeight(state.records, exWheel.exId, viewDate) ?? 50
  })()
  const exHasValue = exWheel ? (record?.sets?.[exWheel.exId]?.[exWheel.index]?.weight ?? '') !== '' : false

  // Reps: arranca en el limite inferior del rango del ejercicio (8-10 -> 8).
  const repLower = (reps: string): number => {
    const m = reps.match(/\d+/)
    const n = m ? parseInt(m[0], 10) : 8
    return Number.isFinite(n) ? Math.max(0, Math.min(20, n)) : 8
  }
  const repInitial = (() => {
    if (!repsWheel) return 0
    const own = record?.sets?.[repsWheel.exId]?.[repsWheel.index]?.reps
    if (own) return parseInt(own, 10) || 0
    const ex = workout?.exercises.find(e => e.id === repsWheel.exId)
    return ex ? repLower(ex.reps) : 8
  })()
  const repHasValue = repsWheel ? (record?.sets?.[repsWheel.exId]?.[repsWheel.index]?.reps ?? '') !== '' : false

  const progress: Record<Sec, number> = {
    sueno: secProgress('sueno', record, workout),
    peso: secProgress('peso', record, workout),
    entreno: secProgress('entreno', record, workout),
    comidas: secProgress('comidas', record, workout),
    actividad: secProgress('actividad', record, workout),
  }

  // Cuanto se desvía la semana en carbos: lo que la IA usa para calibado.
  const weekCarbs = (() => {
    let delta = 0
    let days = 0
    for (const d of lastNDates(7)) {
      const r = getRecord(state.records, d)
      if (!r?.meals?.length) continue
      days++
      delta += dayMacros(r).carb - targets.carb
    }
    return { delta: Math.round(delta), days }
  })()

  const traceTasks: { id: string; sec: Sec; label: string; status: string; done: boolean }[] = [
    { id: 'peso', sec: 'peso', label: 'Peso', status: record?.weight != null ? `${record.weight} kg` : 'Falta', done: record?.weight != null },
    {
      id: 'pasos', sec: 'actividad', label: 'Pasos',
      status: record?.steps != null ? `${record.steps.toLocaleString('es-PE')} / ${stepsTarget.toLocaleString('es-PE')}` : 'Falta',
      done: record?.steps != null,
    },
    { id: 'entreno', sec: 'entreno', label: 'Entreno', status: progress.entreno >= 1 ? 'Listo' : 'Falta', done: progress.entreno >= 1 },
    { id: 'sueno', sec: 'sueno', label: 'Sueno', status: progress.sueno >= 1 ? `${slept?.toFixed(1) ?? '—'} h` : 'Falta', done: progress.sueno >= 1 },
    { id: 'cintura', sec: 'actividad', label: 'Cintura', status: waistDue ? 'Esta semana' : `${recentWaist?.waist} cm`, done: !waistDue },
  ]
  const pendingTrace = traceTasks.filter(t => !t.done).length + (foodCoverage.complete ? 0 : 1)
  const nextTask = traceTasks.find(t => !t.done)
  const primaryTraceLabel = !foodCoverage.complete
    ? `Registrar ${SLOT_LABEL[preferredSlot].toLowerCase()}`
    : nextTask
      ? `Registrar ${nextTask.label.toLowerCase()}`
      : 'Registrar algo más'

  const openMeasure = (field: 'steps' | 'waist') => {
    setMeasureDraft(String(field === 'steps' ? record?.steps ?? '' : record?.waist ?? ''))
    setMeasureError(null)
    setMeasureField(field)
  }

  const openTraceTask = (task: (typeof traceTasks)[number]) => {
    if (task.id === 'peso') setWeightPicker(true)
    else if (task.id === 'pasos') openMeasure('steps')
    else if (task.id === 'cintura') openMeasure('waist')
    else setOpenSec(task.sec)
  }

  const runPrimaryTrace = () => {
    if (!foodCoverage.complete) setEstimating(preferredSlot)
    else if (nextTask) openTraceTask(nextTask)
    else setEstimating('extra')
  }

  const toggleSkip = (slot: MealSlot) => {
    const skipped = record?.skipped ?? []
    const on = !skipped.includes(slot)
    const next = on ? [...skipped, slot] : skipped.filter(x => x !== slot)
    app.updateRecord({ skipped: next.length > 0 ? next : undefined }, viewDate)
    setToast(on ? `No comi ${SLOT_LABEL[slot].toLowerCase()}` : `${SLOT_LABEL[slot]} desmarcado`)
  }

  return (
    <>
      {/* --- Navegacion de dias --- */}
      <div className="mx-days">
        <button
          className="mx-day-arrow"
          onClick={() => setViewDate(addDays(viewDate, -1))}
          aria-label="Dia anterior"
        >‹</button>
        <div className="mx-day-c">
          <div className="mx-eyebrow">{viewDate === today ? 'Hoy' : headerDate(parseDate(viewDate) ?? new Date())}</div>
          <div className="mx-day-v mx-mono">{shortDate(viewDate)}</div>
        </div>
        <button
          className="mx-day-arrow"
          onClick={() => setViewDate(addDays(viewDate, 1))}
          disabled={viewDate === today}
          aria-label="Dia siguiente"
        >›</button>
        {viewDate !== today && (
          <button className="mx-mini" onClick={goToday}>Hoy</button>
        )}
      </div>

      {/* Registrar manda: todas las acciones del dia quedan antes del progreso. */}
      <section className="mx-trace-now" data-complete={pendingTrace === 0 ? '1' : '0'} aria-label="Pendientes de hoy">
        <div className="mx-trace-head">
          <div>
            <div className="mx-eyebrow">Traza hoy</div>
            <div className="mx-trace-title">
              {pendingTrace === 0 ? 'Hoy quedó trazado' : `Te faltan ${pendingTrace} registros`}
            </div>
            <div className="mx-sub">{pendingTrace === 0 ? 'Ya puedes confiar en los datos de hoy.' : 'No cierres el día con huecos.'}</div>
          </div>
          <div className="mx-trace-kcal" data-over={kcalLeft < 0 ? '1' : '0'}>
            <b className="mx-mono">{kcalLeft >= 0 ? kcalLeft : `+${Math.abs(kcalLeft)}`}</b>
            <span>kcal {kcalLeft >= 0 ? 'disponibles' : 'de más'}</span>
          </div>
        </div>

        <button className="mx-trace-primary" onClick={runPrimaryTrace}>
          {primaryTraceLabel}
          <span>
            {!foodCoverage.complete
              ? `${foodCoverage.covered}/${foodCoverage.total} comidas confirmadas`
              : nextTask
                ? 'Toca para completar ahora'
                : 'El día está completo'}
          </span>
        </button>

        <div className="mx-trace-grid">
          {traceTasks.map(task => (
            <button
              key={task.id}
              className="mx-trace-task"
              data-done={task.done ? '1' : '0'}
              onClick={() => openTraceTask(task)}
              aria-label={`${task.label}: ${task.status}`}
            >
              <SectionIcon id={task.sec} />
              <span>{task.label}<small>{task.status}</small></span>
              <i aria-hidden>{task.done ? '✓' : '→'}</i>
            </button>
          ))}
        </div>

        <div className="mx-trace-foot">
          <button onClick={() => setOpenSec('comidas')}>Ver todas las comidas</button>
          {!foodCoverage.complete && <button onClick={() => setClosingDay(true)}>Cerrar comidas</button>}
          {foodCoverage.complete && <span>Comidas cerradas ✓</span>}
        </div>
      </section>

      {/* La cuenta regresiva tiene contexto antes que cualquier peso. */}
      <section className="mx-deadline" aria-label="Progreso hacia la boda">
        <div className="mx-deadline-main">
          {goalWeight != null && state.settings.targetDate ? (
            <>
              <div className="mx-deadline-days">
                <b className="mx-mono">{goalDays != null ? Math.max(0, goalDays) : '—'}</b>
                <span>días para la boda</span>
              </div>
              <div className="mx-deadline-weights">
                <span>Peso actual <b className="mx-mono">{avg7 != null ? `${avg7.toFixed(1)} kg` : 'sin promedio'}</b></span>
                <span>Meta de boda <b className="mx-mono">{goalWeight} kg</b></span>
              </div>
            </>
          ) : (
            <div className="mx-deadline-empty">Define la fecha y el peso de tu meta.</div>
          )}
          <button className="mx-mini" onClick={() => setGoalEditor(true)}>Editar</button>
        </div>
        {goalWeight != null && state.settings.targetDate && (
          <div className="mx-deadline-pace">
            <span>Necesitas <b className="mx-mono">{requiredPerWeek != null ? `-${requiredPerWeek.toFixed(1)} kg/sem` : 'más pesajes'}</b></span>
            <span>Vas a <b className="mx-mono">{actualTrend != null ? `${actualTrend > 0 ? '+' : ''}${actualTrend.toFixed(1)} kg/sem` : 'sin tendencia'}</b></span>
            {projectedGoalWeight != null && <span>Proyección <b className="mx-mono">{projectedGoalWeight.toFixed(1)} kg</b></span>}
          </div>
        )}
      </section>

      <div className="mx-bp">
        <MacroPie label={MACRO_LABEL.prot} eaten={eaten.prot} target={targets.prot} tone="prot" />
        <MacroPie label={MACRO_LABEL.carb} eaten={eaten.carb} target={targets.carb} tone="carb" />
        <MacroPie label={MACRO_LABEL.grasa} eaten={eaten.grasa} target={targets.grasa} tone="grasa" />
      </div>

      <section className="mx-progress-section" aria-label="Progreso y tendencias">
        <div className="mx-progress-head">
          <div className="mx-eyebrow">Tu progreso</div>
          <div>La semana, tendencias y gráficos viven aquí.</div>
        </div>
        <WeekScreen app={app} onSelectDate={setViewDate} />
      </section>

      {/* --- Contenido del registro en modales (una categoria a la vez) --- */}
      <BottomSheet open={goalEditor} onClose={() => setGoalEditor(false)} title="Editar meta">
        <div className="mx-sub" style={{ marginBottom: 10 }}>
          La portada usa estos datos para mostrar los días restantes y el ritmo necesario.
        </div>
        <Field label="Peso objetivo">
          <Stepper
            value={state.settings.targetWeight ?? 95}
            onChange={v => app.updateSettings({ targetWeight: Math.max(30, v) })}
            step={0.5}
            ariaLabel="Peso objetivo en kilogramos"
            min={30}
            suffix="kg"
          />
        </Field>
        <Field label="Fecha objetivo">
          <input
            className="mx-in mx-date"
            type="date"
            value={state.settings.targetDate ?? ''}
            onChange={e => app.updateSettings({ targetDate: e.target.value || undefined })}
          />
        </Field>
        <div className="mx-acts">
          <button
            className="mx-btn"
            data-p="1"
            onClick={() => {
              if (state.settings.targetWeight == null) app.updateSettings({ targetWeight: 95 })
              setGoalEditor(false)
            }}
          >
            Guardar meta
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={closingDay} onClose={() => setClosingDay(false)} title="Cerrar comidas">
        <div className="mx-close-summary">
          <div className="mx-lbl">Falta confirmar</div>
          <div className="mx-close-slots">
            {missingSlots.map(s => <span key={s.id}>{s.label}</span>)}
          </div>
          <p>Si comiste algo más, regístralo. Si no, confirma que no comiste nada más.</p>
        </div>
        <div className="mx-acts">
          <button
            className="mx-btn"
            data-p="1"
            onClick={() => {
              app.updateRecord({ skipped: [...new Set([...(record?.skipped ?? []), ...missingSlots.map(s => s.id)])] }, viewDate)
              setClosingDay(false)
              setToast('Comidas del día cerradas')
            }}
          >
            No comí nada más
          </button>
          <button className="mx-btn" onClick={() => { setClosingDay(false); setOpenSec('comidas') }}>
            Registrar comida
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={openSec !== null}
        onClose={() => setOpenSec(null)}
        title={SECS.find(s => s.id === openSec)?.label ?? ''}
        center
      >
        {openSec === 'sueno' && (
          <>
          <Field label="Me acoste" sub="Si fue despues de medianoche, cuenta para ayer">
            <div className="mx-time">
              <button
                className="mx-time-trigger mx-mono"
                data-empty={record?.bedTime ? '0' : '1'}
                onClick={() => setSleepPicker('bed')}
              >
                {record?.bedTime ?? '—'}
              </button>
              {record?.bedTime && (
                <button
                  className="mx-time-x"
                  onClick={() => app.updateRecord({ bedTime: undefined }, viewDate)}
                  aria-label="Borrar hora de acostarse"
                >✕</button>
              )}
            </div>
          </Field>
          <Field label="Me desperte">
            <div className="mx-time">
              <button
                className="mx-time-trigger mx-mono"
                data-empty={record?.wakeTime ? '0' : '1'}
                onClick={() => setSleepPicker('wake')}
              >
                {record?.wakeTime ?? '—'}
              </button>
              {record?.wakeTime && (
                <button
                  className="mx-time-x"
                  onClick={() => app.updateRecord({ wakeTime: undefined }, viewDate)}
                  aria-label="Borrar hora de despertar"
                >✕</button>
              )}
            </div>
          </Field>
          {slept !== null && (
            <div className="mx-row">
              <div>
                <div className="mx-lbl">Total dormido</div>
                <div className="mx-sub">Meta {sleepTarget} h</div>
              </div>
              <div className="mx-sleep mx-mono">{slept} h</div>
            </div>
          )}
          </>
        )}

      {openSec === 'peso' && (
        <>
          <Field label="Peso en ayunas" sub="Un valor al dia. El sistema usa la media de 7 dias.">
            <div className="mx-time">
              <button
                className="mx-time-trigger mx-mono"
                data-empty={record?.weight != null ? '0' : '1'}
                onClick={() => setWeightPicker(true)}
              >
                {record?.weight != null ? `${record.weight} kg` : '—'}
              </button>
              {record?.weight != null && (
                <button
                  className="mx-time-x"
                  onClick={() => app.updateRecord({ weight: undefined }, viewDate)}
                  aria-label="Borrar peso en ayunas"
                >✕</button>
              )}
            </div>
          </Field>
        </>
      )}

      {openSec === 'entreno' && (
        <>
          <select
            className="mx-sel"
            value={workout?.id ?? ''}
            onChange={e => app.setWorkout(e.target.value || null, viewDate)}
          >
            <option value="">Descanso</option>
            {split.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          {split.length === 0 ? (
            <div className="mx-empty">
              Todavia no tienes rutina. En <b>Mi plan → Entrenamiento</b> puedes cargar la
              Upper/Lower o armar la tuya.
            </div>
          ) : !workout ? (
            <div className="mx-empty">Dia de descanso.</div>
          ) : workout.exercises.length === 0 ? (
            <div className="mx-empty">Este dia no tiene ejercicios. Agregalos en Mi plan.</div>
          ) : (
            workout.exercises.map(ex => {
              const stored = record?.sets?.[ex.id] ?? []
              const sets = makeEmptySets(ex.sets).map((empty, i) => stored[i] ?? empty)
              return (
                <div key={ex.id} className="mx-ex">
                  <div className="mx-ex-h">
                    <div className="mx-ex-n">{ex.name}</div>
                    <div className="mx-ex-o">{ex.sets} × {ex.reps}</div>
                  </div>
                  <div className="mx-set">
                    <div />
                    <div className="mx-sethd">Peso kg</div>
                    <div className="mx-sethd">Reps</div>
                  </div>
                  {sets.map((set, i) => {
                    const prev = lastSessionWeight(state.records, ex.id, viewDate)
                    const guide = prev ?? 50 // primer entreno: el wheel arranca en 50
                    return (
                      <div key={i} className="mx-set">
                        <div className="mx-setn">Serie {i + 1}</div>
                        <span className="mx-setw">
                          <button
                            className="mx-in mx-weight-trigger mx-mono"
                            data-empty={set.weight ? '0' : '1'}
                            onClick={() => setExWheel({ exId: ex.id, index: i })}
                            title="Peso, en kg o lb"
                          >
                            {set.weight ? `${set.weight} kg` : `${guide} kg`}
                          </button>
                          {set.weight && (
                            <button
                              className="mx-in-x"
                              onClick={() => app.setSet(ex.id, i, 'weight', '', viewDate)}
                              aria-label={`Borrar peso serie ${i + 1}`}
                              title="Borrar peso"
                            >✕</button>
                          )}
                        </span>
                        <span className="mx-setw">
                          <button
                            className="mx-in mx-reps-trigger mx-mono"
                            data-empty={set.reps ? '0' : '1'}
                            onClick={() => setRepsWheel({ exId: ex.id, index: i })}
                            title="Repeticiones"
                          >
                            {set.reps || repLower(ex.reps)}
                          </button>
                          {set.reps && (
                            <button
                              className="mx-in-x"
                              onClick={() => app.setSet(ex.id, i, 'reps', '', viewDate)}
                              aria-label={`Borrar reps serie ${i + 1}`}
                              title="Borrar reps"
                            >✕</button>
                          )}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )
          })
        )}
        </>
      )}

      {openSec === 'comidas' && (
        <>
          <div className="mx-slots">
            {SLOTS.map(s => {
              const logged = mealsInSlot(record, s.id)
              return (
                <div key={s.id} className="mx-slot">
                  <div className="mx-slot-h">
                    <div className="mx-eyebrow">{s.label}</div>
                    <div className="mx-slot-acts">
                      {logged.length > 0 && (
                        <button className="mx-mini" onClick={() => setEstimating(s.id)}>+ Agregar</button>
                      )}
                      <button
                        className="mx-q"
                        onClick={() => setIdeaSlot(s.id)}
                        aria-label={`Ideas para ${s.label}`}
                      >?</button>
                    </div>
                  </div>

                  {logged.length === 0 ? (
                    <div className="mx-pickrow">
                      <button className="mx-pick" onClick={() => setEstimating(s.id)}>
                        <span>+</span> Registrar {s.label.toLowerCase()}
                      </button>
                      <button
                        className="mx-skip"
                        data-on={(record?.skipped ?? []).includes(s.id) ? '1' : '0'}
                        aria-pressed={(record?.skipped ?? []).includes(s.id)}
                        onClick={() => toggleSkip(s.id)}
                      >
                        {(record?.skipped ?? []).includes(s.id) ? 'Saltado' : 'No comi'}
                      </button>
                    </div>
                  ) : (
                    logged.map(m => {
                      const mm = roundMacros(mealMacros(m))
                      return (
                        <div key={m.id} className="mx-logged">
                          <button className="mx-logged-b" onClick={() => setEditing(m)}>
                        <div className="mx-logged-n">
                          <span className="mx-logged-name">{mealName(m)}</span>
                          {m.portion !== 1 && <i className="mx-logged-p">× {portionLabel(m.portion)}</i>}
                          {m.ai && <i className="mx-logged-off">IA</i>}
                        </div>
                            {m.note && <div className="mx-logged-note">{m.note}</div>}
                            <div className="mx-logged-m mx-mono">
                              <span>{mm.prot}P</span><span>{mm.carb}C</span><span>{mm.grasa}G</span>
                            </div>
                          </button>
                          <button className="mx-entry-x" onClick={() => app.removeMeal(m.id, viewDate)} aria-label="Quitar">✕</button>
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      </BottomSheet>

      <BottomSheet
        open={measureField !== null}
        onClose={() => setMeasureField(null)}
        title={measureField === 'steps' ? 'Registrar pasos' : 'Medir cintura'}
      >
        {measureField && (() => {
          const parsed = Number(measureDraft.replace(',', '.'))
          const valid = Number.isFinite(parsed) && parsed > 0
          const stepsLeft = measureField === 'steps' && valid ? Math.max(0, stepsTarget - parsed) : null
          return (
            <>
              <div className="mx-measure-intro">
                <div className="mx-eyebrow">
                  {measureField === 'steps' ? `Objetivo ${stepsTarget.toLocaleString('es-PE')}` : 'Una vez por semana'}
                </div>
                <p>
                  {measureField === 'steps'
                    ? 'Copia el total de hoy desde Salud o tu reloj.'
                    : 'Cinta horizontal al nivel del ombligo, abdomen relajado.'}
                </p>
              </div>
              <div className="mx-measure-value">
                <input
                  autoFocus
                  data-autofocus="true"
                  value={measureDraft}
                  inputMode={measureField === 'steps' ? 'numeric' : 'decimal'}
                  aria-label={measureField === 'steps' ? 'Pasos de hoy' : 'Cintura en centimetros'}
                  placeholder="0"
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => { setMeasureDraft(e.target.value); setMeasureError(null) }}
                />
                <span>{measureField === 'steps' ? 'pasos' : 'cm'}</span>
              </div>
              {measureField === 'steps' && valid && (
                <div className="mx-measure-result" data-done={stepsLeft === 0 ? '1' : '0'}>
                  {stepsLeft === 0
                    ? parsed > stepsTarget
                      ? `Objetivo superado por ${Math.round(parsed - stepsTarget).toLocaleString('es-PE')} pasos.`
                      : 'Objetivo de pasos cumplido.'
                    : `Te faltan ${stepsLeft?.toLocaleString('es-PE')} pasos para el objetivo.`}
                </div>
              )}
              {measureError && <div className="mx-inline-error" role="alert">{measureError}</div>}
              <div className="mx-acts">
                <button
                  className="mx-btn"
                  data-p="1"
                  onClick={() => {
                    if (!valid) { setMeasureError('Escribe un número mayor que cero.'); return }
                    if (measureField === 'steps') app.updateRecord({ steps: Math.round(parsed) }, viewDate)
                    else app.updateRecord({ waist: Math.round(parsed * 10) / 10 }, viewDate)
                    setToast(measureField === 'steps' ? 'Pasos guardados' : 'Cintura guardada')
                    setMeasureField(null)
                  }}
                >
                  Guardar {measureField === 'steps' ? 'pasos' : 'cintura'}
                </button>
              </div>
            </>
          )
        })()}
      </BottomSheet>

      {estimating && (
        <MealEstimateSheet
          open
          slot={estimating}
          reference={slotReference(state.settings, estimating)}
          savedMeals={state.settings.savedMeals}
          onClose={() => setEstimating(null)}
          onUseSaved={saved => {
            app.logSavedMeal(estimating, saved, 1, viewDate)
            setToast(`${SLOT_LABEL[estimating]} registrado`)
            setEstimating(null)
          }}
          onEstimate={(custom, note) => {
            app.logAiMeal(estimating, custom.name, custom, note, viewDate)
            setToast(`${SLOT_LABEL[estimating]} registrado`)
            setEstimating(null)
          }}
          onSaveRecurring={saved => {
            app.upsertSavedMeal(saved)
            setToast('Guardada como repetida')
          }}
        />
      )}

      {ideaSlot && (
        <MealIdeaSheet
          open
          slot={ideaSlot}
          context={{
            gymDay: (workout?.exercises.length ?? 0) > 0,
            carbsTarget: targets.carb,
            carbsEatenToday: Math.round(eaten.carb),
            carbsRemainingToday: Math.round(targets.carb - eaten.carb),
            weekCarbsDelta: weekCarbs.delta,
            weekDaysLogged: weekCarbs.days,
            protTarget: targets.prot,
            protEatenToday: Math.round(eaten.prot),
            slotRef: slotReference(state.settings, ideaSlot),
          }}
          onClose={() => setIdeaSlot(null)}
          onUse={(custom, note) => {
            app.logAiMeal(ideaSlot, custom.name, custom, note, viewDate)
            setToast(`${SLOT_LABEL[ideaSlot]} registrado`)
          }}
        />
      )}

      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title="Ajustar comida">
        {editing && (
          <>
            <div className="mx-lbl">{mealName(editing)}</div>
            <div className="mx-sub" style={{ marginBottom: 14 }}>
              {(() => {
                const m = roundMacros(mealMacros(editing))
                return `${m.prot} g proteina · ${m.carb} g carbo · ${m.grasa} g grasa`
              })()}
            </div>
            <Field label="Porcion" sub="Cuanto comiste respecto a la porcion normal">
              <Seg
                opts={PORTIONS.map(portionLabel)}
                value={portionLabel(editing.portion)}
                onChange={v => {
                  const p = PORTIONS.find(x => portionLabel(x) === v) ?? 1
                  app.setPortion(editing.id, p, viewDate)
                  setEditing({ ...editing, portion: p })
                }}
              />
            </Field>
            <div className="mx-acts">
              <button className="mx-btn" data-p="1" onClick={() => setEditing(null)}>Listo</button>
              <button
                className="mx-btn"
                onClick={() => {
                  app.upsertSavedMeal({
                    id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: editing.custom?.name || mealName(editing),
                    prot: editing.custom?.prot ?? 0,
                    carb: editing.custom?.carb ?? 0,
                    grasa: editing.custom?.grasa ?? 0,
                    ...(editing.note ? { note: editing.note } : {}),
                  })
                  setToast('Guardada como repetida')
                  setEditing(null)
                }}
              >
                Guardar repetida
              </button>
              <ConfirmButton
                label="Quitar"
                confirmLabel="Confirmar"
                onConfirm={() => { app.removeMeal(editing.id, viewDate); setEditing(null) }}
              />
            </div>
          </>
        )}
      </BottomSheet>

      <Toast message={toast} onDone={() => setToast(null)} />

      <TimeWheel
        open={sleepPicker !== null}
        title={sleepPicker === 'bed' ? 'Me acoste' : 'Me desperte'}
        value={sleepPicker === 'bed' ? record?.bedTime : sleepPicker === 'wake' ? record?.wakeTime : undefined}
        initialValue={sleepPicker === 'bed' ? previousBedTime : sleepPicker === 'wake' ? previousWakeTime : undefined}
        onClose={() => setSleepPicker(null)}
        onChange={v => {
          app.updateRecord(
            sleepPicker === 'bed' ? { bedTime: v } : { wakeTime: v },
            viewDate,
          )
          setSleepPicker(null)
        }}
      />

      <WeightWheel
        open={weightPicker}
        title="Peso en ayunas"
        initialKg={weightStart}
        hasValue={record?.weight != null}
        onClose={() => setWeightPicker(false)}
        onChange={v => {
          app.updateRecord({ weight: v }, viewDate)
          setWeightPicker(false)
        }}
      />

      {exWheel && (
        <WeightWheel
          open
          title="Peso de la serie (kg o lb)"
          initialKg={exInitial}
          hasValue={exHasValue}
          minKg={5}
          maxKg={300}
          onClose={() => setExWheel(null)}
          onChange={v => {
            app.setSet(exWheel.exId, exWheel.index, 'weight', v != null ? String(v) : '', viewDate)
            setExWheel(null)
          }}
        />
      )}

      {repsWheel && (
        <RepsWheel
          open
          title="Repeticiones de la serie"
          initial={repInitial}
          hasValue={repHasValue}
          onClose={() => setRepsWheel(null)}
          onChange={v => {
            app.setSet(repsWheel.exId, repsWheel.index, 'reps', v != null ? String(v) : '', viewDate)
            setRepsWheel(null)
          }}
        />
      )}
    </>
  )
}