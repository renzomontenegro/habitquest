import { useState } from 'react'
import type { AppController } from '../hooks/useAppState'
import type { MealLog, MealSlot } from '../types'
import {
  addDays, dayMacros, daysBetween, foodLogCoverage, getRecord, headerDate, kcal, lastNDates, lastSessionWeight,
  makeEmptySets, mealMacros, mealName, mealsInSlot, nearestWeight, parseDate, roundMacros, rumboWeek, shortDate, sleepHours,
  slotReference, weightAvg, weightTrendAt, workoutForDate,
} from '../lib/logic'
import { PORTIONS, SLOTS, SLOT_LABEL } from '../lib/config'
import { MealEstimateSheet } from '../components/MealEstimateSheet'
import { MealIdeaSheet } from '../components/MealIdeaSheet'
import { WeekScreen } from './WeekScreen'
import { BottomSheet, ConfirmButton, Field, RepsWheel, Seg, Stepper, TimeWheel, Toast, WeightWheel } from '../components/ui'
import { RumboChart } from '../components/charts'

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
      if (record?.workoutId === null || !workout) return 1 // descanso explicito o planificado
      if (workout.exercises.length === 0) return 0
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
  const [tasksOpen, setTasksOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [measureField, setMeasureField] = useState<'steps' | 'waist' | null>(null)
  const [measureDate, setMeasureDate] = useState(viewDate)
  const [measureDraft, setMeasureDraft] = useState('')
  const [measureError, setMeasureError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const workout = workoutForDate(record, split, viewDate)
  const weightStart = record?.weight ?? nearestWeight(state.records, viewDate) ?? 100
  const eatenKcal = kcal(eaten)
  const targetKcal = kcal(targets)
  const foodCoverage = foodLogCoverage(record)
  const missingSlots = SLOTS.filter(s =>
    mealsInSlot(record, s.id).length === 0 && !(record?.skipped ?? []).includes(s.id),
  )
  const hour = viewDate === today ? new Date().getHours() : 23
  const dueMealIds: MealSlot[] = hour < 11
    ? ['desayuno']
    : hour < 17
      ? ['almuerzo', 'desayuno']
      : ['cena', 'almuerzo', 'desayuno']
  const dueMealSlot = dueMealIds.find(id => missingSlots.some(s => s.id === id)) ?? null
  const avg7 = weightAvg(state.records, addDays(viewDate, -6), viewDate)
  const goalDays = state.settings.targetDate ? daysBetween(viewDate, state.settings.targetDate) : null
  const goalWeight = state.settings.targetWeight
  const actualTrend = weightTrendAt(state.records, viewDate)?.delta ?? null
  const projectedGoalWeight = avg7 != null && actualTrend != null && goalDays != null && goalDays > 0
    ? avg7 + actualTrend * (goalDays / 7)
    : null
  const rumbo = rumboWeek(state.records, state.settings, viewDate)
  const scoredDays = rumbo.days.filter(day => day.points != null).length
  const nutrientDelta = {
    kcal: targetKcal - eatenKcal,
    prot: targets.prot - eaten.prot,
    carb: targets.carb - eaten.carb,
    grasa: targets.grasa - eaten.grasa,
  }
  const firstWeight = state.records
    .filter(r => r.weight != null && r.date >= state.settings.startDate && r.date <= viewDate)
    .sort((a, b) => a.date.localeCompare(b.date))[0]?.weight
  const weightProgress = firstWeight != null && avg7 != null && goalWeight != null && firstWeight !== goalWeight
    ? Math.max(0, Math.min(1, (firstWeight - avg7) / (firstWeight - goalWeight)))
    : 0
  const weightTone = weightProgress >= 0.75 ? 'good' : weightProgress >= 0.33 ? 'warn' : 'bad'
  const recentWaist = state.records
    .filter(r => r.waist != null && r.date <= viewDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const waistDue = !recentWaist || daysBetween(recentWaist.date, viewDate) >= 7
  const yesterday = addDays(today, -1)
  const yesterdayRecord = getRecord(state.records, yesterday)
  const missedYesterdaySteps = viewDate === today && yesterdayRecord?.steps == null

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

  const traceTasks: { id: string; sec: Sec; label: string; status: string; consequence: string; done: boolean; due: boolean }[] = [
    { id: 'peso', sec: 'peso', label: 'Peso', status: record?.weight != null ? `${record.weight} kg` : 'Falta', consequence: 'Sin peso no hay ajuste semanal', done: record?.weight != null, due: true },
    {
      id: 'pasos', sec: 'actividad', label: 'Pasos',
      status: record?.steps != null
        ? `${record.steps.toLocaleString('es-PE')} / ${stepsTarget.toLocaleString('es-PE')}`
        : hour >= 23 ? 'Falta' : 'A las 11 p. m.',
      consequence: 'Si queda sin registrar: −1',
      done: record?.steps != null,
      due: hour >= 23,
    },
    { id: 'entreno', sec: 'entreno', label: 'Entreno', status: progress.entreno >= 1 ? 'Listo' : 'Falta', consequence: 'Si no completas el plan: −2', done: progress.entreno >= 1, due: true },
    { id: 'sueno', sec: 'sueno', label: 'Sueno', status: progress.sueno >= 1 ? `${slept?.toFixed(1) ?? '—'} h` : 'Falta', consequence: 'Si queda sin registrar: −1', done: progress.sueno >= 1, due: true },
    { id: 'cintura', sec: 'actividad', label: 'Cintura', status: waistDue ? 'Medicion semanal' : `${recentWaist?.waist} cm`, consequence: 'No cambia la puntuacion', done: !waistDue, due: waistDue },
  ]
  const foodPendingNow = dueMealSlot !== null || (hour >= 21 && !foodCoverage.complete)
  const pendingToday = traceTasks.filter(t => t.due && !t.done).length + (foodPendingNow ? 1 : 0)
  const pendingTrace = pendingToday + (missedYesterdaySteps ? 1 : 0)
  const taskById = (id: string) => traceTasks.find(task => task.id === id && task.due && !task.done)
  const priority = hour < 11
    ? ['yesterdaySteps', 'peso', 'sueno', 'meal', 'cintura', 'entreno', 'pasos']
    : hour < 17
      ? ['meal', 'yesterdaySteps', 'peso', 'sueno', 'entreno', 'cintura', 'pasos']
      : ['meal', 'yesterdaySteps', 'entreno', 'pasos', 'closeFood', 'peso', 'sueno', 'cintura']
  const primaryKey = priority.find(key => {
    if (key === 'yesterdaySteps') return missedYesterdaySteps
    if (key === 'meal') return dueMealSlot !== null
    if (key === 'closeFood') return hour >= 21 && !foodCoverage.complete
    return taskById(key) != null
  }) ?? 'extra'
  const primaryTask = taskById(primaryKey)
  const primaryTraceLabel = primaryKey === 'yesterdaySteps'
    ? 'Registrar pasos de ayer'
    : primaryKey === 'meal' && dueMealSlot
      ? `Registrar ${SLOT_LABEL[dueMealSlot].toLowerCase()}`
      : primaryKey === 'closeFood'
        ? 'Cerrar comidas de hoy'
      : primaryTask
        ? `Registrar ${primaryTask.label.toLowerCase()}`
        : 'Registrar algo más'
  const openMeasure = (field: 'steps' | 'waist', date = viewDate) => {
    const source = getRecord(state.records, date)
    setMeasureDate(date)
    setMeasureDraft(String(field === 'steps' ? source?.steps ?? '' : source?.waist ?? ''))
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
    if (primaryKey === 'yesterdaySteps') openMeasure('steps', yesterday)
    else if (primaryKey === 'meal' && dueMealSlot) setEstimating(dueMealSlot)
    else if (primaryKey === 'closeFood') setClosingDay(true)
    else if (primaryTask) openTraceTask(primaryTask)
    else setEstimating('extra')
  }

  const markSkipped = (slot: MealSlot) => {
    const skipped = record?.skipped ?? []
    if (!skipped.includes(slot)) app.updateRecord({ skipped: [...skipped, slot] }, viewDate)
    setToast(`No comi ${SLOT_LABEL[slot].toLowerCase()}`)
  }

  const toggleSkip = (slot: MealSlot) => {
    const skipped = record?.skipped ?? []
    if (!skipped.includes(slot)) { markSkipped(slot); return }
    const next = skipped.filter(x => x !== slot)
    app.updateRecord({ skipped: next.length > 0 ? next : undefined }, viewDate)
    setToast(`${SLOT_LABEL[slot]} desmarcado`)
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

      <button className="mx-wedding-progress mx-wedding-progress-first" data-tone={weightTone}
        onClick={() => actualTrend == null && record?.weight == null ? setWeightPicker(true) : setProgressOpen(true)}>
        <span><small>Dias para la boda</small><b className="mx-mono">{goalDays != null ? Math.max(0, goalDays) : '—'}</b></span>
        <span><small>Peso actual</small><b>{avg7 != null ? `${avg7.toFixed(1)} kg` : 'Sin promedio'}</b></span>
        <span><small>Proyeccion</small><b>{projectedGoalWeight != null ? `${projectedGoalWeight.toFixed(1)} kg` : 'Faltan datos'}</b></span>
        <i className="mx-wedding-progress-bar" style={{ width: `${Math.max(4, weightProgress * 100)}%` }} />
      </button>

      <section className="mx-rumbo" aria-label="Puntuacion semanal">
        <div className="mx-rumbo-head">
          <div>
            <div className="mx-eyebrow">Progreso semanal</div>
            <h2>{rumbo.score > 0 ? `+${rumbo.score}` : rumbo.score} puntos</h2>
            <p>{scoredDays} {scoredDays === 1 ? 'dia puntuado' : 'dias puntuados'} · tendencia {actualTrend != null ? `${actualTrend > 0 ? '+' : ''}${actualTrend.toFixed(1)} kg/sem` : 'sin calcular'}</p>
          </div>
          <b className="mx-rumbo-score mx-mono" data-tone={rumbo.score >= 40 ? 'good' : rumbo.score >= 0 ? 'warn' : 'bad'}>
            {rumbo.score >= 40 ? '↑' : rumbo.score >= 0 ? '→' : '↓'}
          </b>
        </div>
        <RumboChart days={rumbo.days} />
        <div className="mx-score-breakdown">
          <span>Registros y habitos <b>{rumbo.daily > 0 ? '+' : ''}{rumbo.daily}</b></span>
          <span>Peso semanal <b>{rumbo.weight > 0 ? '+' : ''}{rumbo.weight}</b></span>
        </div>
        <button className="mx-now-primary" onClick={runPrimaryTrace}>
          {pendingTrace === 0 ? 'Registrar algo más' : primaryTraceLabel}
        </button>
      </section>

      <section className="mx-daily-numbers" aria-label="Lo que falta o sobra hoy">
        <div data-over={nutrientDelta.kcal < 0 ? '1' : '0'}><small>Kcal</small><b className="mx-mono">{Math.abs(Math.round(nutrientDelta.kcal))}</b><span>{nutrientDelta.kcal >= 0 ? 'faltan' : 'sobran'}</span></div>
        <div data-over={nutrientDelta.prot < 0 ? '1' : '0'}><small>Proteina</small><b className="mx-mono">{Math.abs(Math.round(nutrientDelta.prot))}g</b><span>{nutrientDelta.prot >= 0 ? 'faltan' : 'sobran'}</span></div>
        <div data-over={nutrientDelta.carb < 0 ? '1' : '0'}><small>Carbo</small><b className="mx-mono">{Math.abs(Math.round(nutrientDelta.carb))}g</b><span>{nutrientDelta.carb >= 0 ? 'faltan' : 'sobran'}</span></div>
        <div data-over={nutrientDelta.grasa < 0 ? '1' : '0'}><small>Grasa</small><b className="mx-mono">{Math.abs(Math.round(nutrientDelta.grasa))}g</b><span>{nutrientDelta.grasa >= 0 ? 'faltan' : 'sobran'}</span></div>
      </section>

      <section className="mx-home-pending" aria-label="Pendientes visibles">
        <div className="mx-home-section-head">
          <div><div className="mx-eyebrow">Pendientes</div><b>{pendingTrace === 0 ? 'Todo listo' : `${pendingTrace} por completar`}</b></div>
          {pendingTrace > 0 && <button onClick={() => setTasksOpen(true)}>Ver detalle</button>}
        </div>
        <div className="mx-home-pending-list">
          {missedYesterdaySteps && (
            <button data-done="0" onClick={() => openMeasure('steps', yesterday)}>
              <span><b>Pasos de ayer</b><small>Si queda sin registrar: −1</small></span><i>→</i>
            </button>
          )}
          <button
            data-done={foodCoverage.complete ? '1' : foodPendingNow ? '0' : 'later'}
            onClick={() => setOpenSec('comidas')}
          >
            <span><b>Comidas</b><small>{foodCoverage.complete ? 'Dia listo para puntuar' : 'Cierra el dia para puntuar'}</small></span>
            <i>{foodCoverage.complete ? '✓' : '→'}</i>
          </button>
          {traceTasks.map(task => (
            <button
              key={task.id}
              data-done={task.done ? '1' : task.due ? '0' : 'later'}
              onClick={() => openTraceTask(task)}
            >
              <span><b>{task.label}</b><small>{task.done ? task.status : task.consequence}</small></span>
              <i>{task.done ? '✓' : task.due ? '→' : '·'}</i>
            </button>
          ))}
        </div>
      </section>

      {/* Los detalles aparecen solo cuando ayudan a completar una accion. */}
      <BottomSheet open={tasksOpen} onClose={() => setTasksOpen(false)} title="Pendientes">
        <div className="mx-task-list">
          {missedYesterdaySteps && (
            <button onClick={() => { setTasksOpen(false); openMeasure('steps', yesterday) }}>
              <SectionIcon id="actividad" />
              <span><b>Pasos de ayer</b><small>Pendiente arrastrado</small></span>
              <i aria-hidden>→</i>
            </button>
          )}
          <button
            data-done={foodCoverage.complete ? '1' : foodPendingNow ? '0' : 'later'}
            onClick={() => { setTasksOpen(false); setOpenSec('comidas') }}
          >
            <SectionIcon id="comidas" />
            <span><b>Comidas</b><small>{foodCoverage.covered}/{foodCoverage.total} confirmadas</small></span>
            <i aria-hidden>{foodCoverage.complete ? '✓' : '→'}</i>
          </button>
          {traceTasks.map(task => (
            <button
              key={task.id}
              data-done={task.done ? '1' : task.due ? '0' : 'later'}
              onClick={() => { setTasksOpen(false); openTraceTask(task) }}
            >
              <SectionIcon id={task.sec} />
              <span><b>{task.label}</b><small>{task.done ? task.status : task.consequence}</small></span>
              <i aria-hidden>{task.done ? '✓' : task.due ? '→' : '·'}</i>
            </button>
          ))}
        </div>
        {!foodCoverage.complete && (
          <button className="mx-btn" onClick={() => { setTasksOpen(false); setClosingDay(true) }}>
            Cerrar comidas de hoy
          </button>
        )}
      </BottomSheet>

      <BottomSheet open={progressOpen} onClose={() => setProgressOpen(false)} title="Progreso" wide>
        <WeekScreen
          app={app}
          onSelectDate={date => { setProgressOpen(false); setViewDate(date) }}
        />
      </BottomSheet>

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
        headExtra={openSec === 'comidas' && (
          <div className="mx-food-summary">
            <div><b className="mx-mono">{eatenKcal}</b><span>de {targetKcal} kcal</span></div>
            <div className="mx-mono"><span>{Math.round(eaten.prot)}P</span><span>{Math.round(eaten.carb)}C</span><span>{Math.round(eaten.grasa)}G</span></div>
          </div>
        )}
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
                <div key={s.id} className="mx-slot" data-logged={logged.length > 0 ? '1' : '0'}>
                  <div className="mx-slot-h">
                    <div className="mx-eyebrow">{s.label}</div>
                    <div className="mx-slot-acts">
                      {logged.length > 0 && (
                        <button
                          className="mx-slot-add"
                          onClick={() => setEstimating(s.id)}
                          aria-label={`Agregar otra comida en ${s.label}`}
                          title="Agregar otra"
                        >+</button>
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
                          {m.aiPending
                            ? <i className="mx-logged-off">Estimando…</i>
                            : m.ai && <i className="mx-logged-off">IA</i>}
                        </div>
                            {m.note && <div className="mx-logged-note">{m.note}</div>}
                            {m.aiPending ? (
                              m.aiError ? (
                                <div className="mx-logged-m"><span className="mx-logged-err">{m.aiError}</span></div>
                              ) : (
                                <div className="mx-logged-m mx-mono"><span>La IA completa los macros sola</span></div>
                              )
                            ) : (
                              <div className="mx-logged-m mx-mono">
                                <span>{mm.prot}P</span><span>{mm.carb}C</span><span>{mm.grasa}G</span>
                              </div>
                            )}
                          </button>
                          {m.aiPending && (m.aiError || Date.now() - m.at > 120_000) && (
                            <button className="mx-mini" onClick={() => app.retryEstimate(m.id, viewDate)}>
                              Reintentar
                            </button>
                          )}
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
        center
        title={measureField === 'steps'
          ? measureDate === today ? 'Registrar pasos' : 'Registrar pasos de ayer'
          : 'Medir cintura'}
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
                    ? `Copia el total de ${measureDate === today ? 'hoy' : 'ayer'} desde Salud o tu reloj.`
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
                    if (measureField === 'steps') app.updateRecord({ steps: Math.round(parsed) }, measureDate)
                    else app.updateRecord({ waist: Math.round(parsed * 10) / 10 }, measureDate)
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
          onSkip={() => markSkipped(estimating)}
          onUseSaved={saved => {
            app.logSavedMeal(estimating, saved, 1, viewDate)
            setToast(`${SLOT_LABEL[estimating]} registrado`)
            setEstimating(null)
          }}
          onFastSave={(note, photos) => {
            const photosSaved = app.logPendingMeal(estimating, note, photos, viewDate)
            setToast(photosSaved
              ? `${SLOT_LABEL[estimating]} guardado. La IA estima en segundo plano.`
              : `${SLOT_LABEL[estimating]} guardado sin foto (sin espacio). Igual se estimara con el texto.`)
            setEstimating(null)
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
                  setToast('Guardada como recurrente')
                  setEditing(null)
                }}
              >
                Guardar como recurrente
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