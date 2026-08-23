import { useRef, useState } from 'react'
import type { AppController } from '../hooks/useAppState'
import type { MealLog, MealSlot } from '../types'
import {
  addDays, dayMacros, getRecord, headerDate, lastNDates, lastSessionWeight, makeEmptySets, mealMacros, mealName,
  mealsInSlot, nearestWeight, parseDate, roundMacros, shortDate, slotReference, workoutForDate,
} from '../lib/logic'
import { MACRO_LABEL, PORTIONS, SLOTS, SLOT_LABEL } from '../lib/config'
import { MealEstimateSheet } from '../components/MealEstimateSheet'
import { MealIdeaSheet } from '../components/MealIdeaSheet'
import { MacroPie } from '../components/charts'
import { BottomSheet, ConfirmButton, Field, RepsWheel, Seg, TimeWheel, Toast, WeightWheel } from '../components/ui'

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
    case 'actividad': {
      const s = (record?.steps != null ? 1 : 0) + (record?.waist != null ? 1 : 0)
      return s === 0 ? 0 : s === 1 ? 0.5 : 1
    }
  }
}

const SECS: { id: Sec; icon: string; label: string; color: string }[] = [
  { id: 'sueno', icon: '😴', label: 'Sueno', color: 'var(--warn)' },
  { id: 'peso', icon: '⚖️', label: 'Peso', color: 'var(--good)' },
  { id: 'entreno', icon: '🏋️', label: 'Entrenamiento', color: 'var(--ink)' },
  { id: 'comidas', icon: '🍽️', label: 'Comidas', color: 'var(--signal)' },
  { id: 'actividad', icon: '🚶', label: 'Actividad', color: 'var(--mute)' },
]

/** Path del "queso" de un pie-circulo: porcion rellena desde las 12 horas. */
function pieSlice(cx: number, cy: number, r: number, pct: number): string {
  const ang = Math.PI * 2 * pct - Math.PI / 2
  const x = cx + r * Math.cos(ang)
  const y = cy + r * Math.sin(ang)
  const large = pct > 0.5 ? 1 : 0
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`
}

/** Circulos de categorias RELLENOS tipo pie, en anillo GIRATORIO (ruleta). */
function CategoryRing({ progress, open, onTap }: {
  progress: Record<Sec, number>
  open: Sec | null
  onTap: (s: Sec) => void
}) {
  const SIZE = 300
  const R = 118
  const CX = SIZE / 2
  const CY = SIZE / 2
  const total = Object.values(progress).reduce((a, b) => a + b, 0) / SECS.length
  const r = 29

  const ringRef = useRef<HTMLDivElement>(null)
  const [rot, setRot] = useState(0)
  const dragging = useRef(false)
  const lastAngle = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)       // grados por segundo
  const moved = useRef(false)      // hubo giro con arrastre (para no disparar el click)
  const raf = useRef<number | null>(null)

  const angleAt = (clientX: number, clientY: number): number => {
    const el = ringRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
  }

  const stopDecay = () => {
    if (raf.current != null) cancelAnimationFrame(raf.current)
    raf.current = null
  }

  const decay = () => {
    stopDecay()
    const step = () => {
      if (Math.abs(velocity.current) < 4) {
        velocity.current = 0
        raf.current = null
        return
      }
      setRot(r => r + velocity.current * 0.016)
      velocity.current *= 0.972 // friccion: se va frenando sola
      raf.current = requestAnimationFrame(step)
    }
    step()
  }

  const onDown = (e: React.PointerEvent) => {
    stopDecay()
    dragging.current = true
    moved.current = false
    lastAngle.current = angleAt(e.clientX, e.clientY)
    lastT.current = performance.now()
    velocity.current = 0
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const a = angleAt(e.clientX, e.clientY)
    const d = (((a - lastAngle.current + 540) % 360) - 180)
    if (Math.abs(d) > 1.5) moved.current = true
    const now = performance.now()
    const dt = Math.max(1, now - lastT.current)
    velocity.current = velocity.current * 0.65 + (d / dt) * 1000 * 0.35
    setRot(r => r + d)
    lastAngle.current = a
    lastT.current = now
  }

  const onUp = () => {
    dragging.current = false
    decay()
  }

  const tap = (s: Sec) => {
    if (moved.current) {
      moved.current = false // fue un giro, no un tap
      return
    }
    onTap(s)
  }

  return (
    <div
      ref={ringRef}
      className="mx-ring"
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    >
      <div className="mx-ring-wheel" style={{ transform: `rotate(${rot}deg)` }}>
        {SECS.map((s, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / SECS.length
          const x = CX + R * Math.cos(ang)
          const y = CY + R * Math.sin(ang)
          const pct = progress[s.id]
          return (
            <button
              key={s.id}
              className="mx-ring-b"
              style={{ left: x - 32, top: y - 32, '--c': s.color } as React.CSSProperties}
              data-on={open === s.id ? '1' : '0'}
              data-done={pct >= 1 ? '1' : '0'}
              onClick={() => tap(s.id)}
              aria-label={`${s.label}: ${Math.round(pct * 100)}%`}
            >
              <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
                <circle cx="32" cy="32" r={r} fill="var(--line)" />
                {pct >= 1 ? (
                  <circle cx="32" cy="32" r={r} fill={s.color} />
                ) : pct > 0 ? (
                  <path d={pieSlice(32, 32, r, pct)} fill={s.color} />
                ) : null}
              </svg>
              <span className="mx-ring-emo" aria-hidden>{s.icon}</span>
            </button>
          )
        })}
      </div>
      <div className="mx-ring-c mx-mono" aria-hidden>
        {Math.round(total * 100)}%
      </div>
    </div>
  )
}

export function TodayScreen({ app, viewDate, setViewDate, goToday }: {
  app: AppController
  viewDate: string
  setViewDate: (d: string) => void
  goToday: () => void
}) {
  const { state, today } = app
  const { split, targets } = state.settings

  const record = getRecord(state.records, viewDate)
  const eaten = dayMacros(record)

  const [estimating, setEstimating] = useState<MealSlot | null>(null)
  const [ideaSlot, setIdeaSlot] = useState<MealSlot | null>(null)
  const [editing, setEditing] = useState<MealLog | null>(null)
  const [sleepPicker, setSleepPicker] = useState<null | 'bed' | 'wake'>(null)
  const [weightPicker, setWeightPicker] = useState(false)
  const [exWheel, setExWheel] = useState<null | { exId: string; index: number }>(null)
  const [repsWheel, setRepsWheel] = useState<null | { exId: string; index: number }>(null)
  const [openSec, setOpenSec] = useState<Sec | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const workout = workoutForDate(record, split, viewDate)
  const weightStart = record?.weight ?? nearestWeight(state.records, viewDate) ?? 100

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

  const toggleSec = (s: Sec) => setOpenSec(prev => (prev === s ? null : s))

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

      <div className="mx-bp">
        <MacroPie label={MACRO_LABEL.prot} eaten={eaten.prot} target={targets.prot} tone="prot" />
        <MacroPie label={MACRO_LABEL.carb} eaten={eaten.carb} target={targets.carb} tone="carb" />
        <MacroPie label={MACRO_LABEL.grasa} eaten={eaten.grasa} target={targets.grasa} tone="grasa" />
      </div>

      {/* --- Anillo de categorias: tap para abrir/cerrar cada una --- */}
      <CategoryRing
        progress={progress}
        open={openSec}
        onTap={toggleSec}
      />
      <div className="mx-ring-hint mx-sub">Toca un circulo para registrar o ver esa categoria.</div>

      {/* --- Contenido de la categoria en modal centrado (una a la vez) --- */}
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

      {openSec === 'actividad' && (
        <>
          <Field label="Pasos" sub="Lo copias de tu celular.">
            <input
              className="mx-in"
              value={record?.steps != null ? String(record.steps) : ''}
              onChange={e => {
                const v = e.target.value
                app.updateRecord({ steps: v === '' ? undefined : parseInt(v, 10) }, viewDate)
              }}
              inputMode="numeric"
              placeholder="—"
            />
          </Field>
          <Field label="Cintura" sub="Al ombligo. Con una vez por semana basta.">
            <input
              className="mx-in"
              value={record?.waist != null ? String(record.waist) : ''}
              onChange={e => {
                const v = e.target.value
                app.updateRecord({ waist: v === '' ? undefined : parseFloat(v) }, viewDate)
              }}
              inputMode="decimal"
              placeholder="—"
            />
          </Field>
        </>
      )}
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