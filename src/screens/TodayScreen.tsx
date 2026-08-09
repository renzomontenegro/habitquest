import { useState } from 'react'
import type { AppController } from '../hooks/useAppState'
import type { MealLog, MealSlot } from '../types'
import {
  addDays, dayMacros, getRecord, headerDate, kcal, makeEmptySets, mealMacros, mealName,
  mealsInSlot, parseDate, roundMacros, shortDate, sleepHours, slotReference, workoutForDate,
} from '../lib/logic'
import { MACRO_LABEL, PORTIONS, SLOTS, SLOT_LABEL } from '../lib/config'
import { MealPicker } from '../components/MealPicker'
import { BottomSheet, ConfirmButton, Field, MacroBar, Seg, Toast } from '../components/ui'

function portionLabel(p: number): string {
  if (p === 0.5) return '½'
  if (p === 1.5) return '1½'
  return String(p)
}

export function TodayScreen({ app, viewDate, setViewDate, goToday }: {
  app: AppController
  viewDate: string
  setViewDate: (d: string) => void
  goToday: () => void
}) {
  const { state, today } = app
  const { options, split, targets } = state.settings

  const record = getRecord(state.records, viewDate)
  const eaten = dayMacros(record, options)

  const [picking, setPicking] = useState<MealSlot | null>(null)
  const [editing, setEditing] = useState<MealLog | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const yesterday = addDays(viewDate, -1)
  const canRepeat = !record?.meals?.length && !!getRecord(state.records, yesterday)?.meals?.length

  const workout = workoutForDate(record, split, viewDate)
  const hours = sleepHours(record?.bedTime, record?.wakeTime)

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

      <div className="mx-mbs">
        <MacroBar label={MACRO_LABEL.prot} eaten={eaten.prot} target={targets.prot} tone="prot" />
        <MacroBar label={MACRO_LABEL.carb} eaten={eaten.carb} target={targets.carb} tone="carb" />
        <MacroBar label={MACRO_LABEL.grasa} eaten={eaten.grasa} target={targets.grasa} tone="grasa" />
      </div>

      {options.length === 0 && (
        <div className="mx-nudge">
          <div className="mx-eyebrow">Falta lo tuyo</div>
          <p>
            Todavia no tienes comidas creadas. En <b>Mi plan</b> defines cada una con sus macros
            una sola vez; despues registrar es elegirla y nada mas.
          </p>
        </div>
      )}

      {canRepeat && (
        <button
          className="mx-repeat"
          onClick={() => { app.copyDay(yesterday, viewDate); setToast('Copiado de ayer') }}
        >
          Comi lo mismo que ayer
        </button>
      )}

      {/* --- Una tarjeta por comida --- */}
      {SLOTS.map(s => {
        const logged = mealsInSlot(record, s.id)
        return (
          <div key={s.id} className="mx-slot">
            <div className="mx-slot-h">
              <div className="mx-eyebrow">{s.label}</div>
              {logged.length > 0 && (
                <button className="mx-mini" onClick={() => setPicking(s.id)}>+ Agregar</button>
              )}
            </div>

            {logged.length === 0 ? (
              <button className="mx-pick" onClick={() => setPicking(s.id)}>
                <span>+</span> Elegir {s.label.toLowerCase()}
              </button>
            ) : (
              logged.map(m => {
                const mm = roundMacros(mealMacros(m, options))
                return (
                  <div key={m.id} className="mx-logged">
                    <button className="mx-logged-b" onClick={() => setEditing(m)}>
                      <div className="mx-logged-n">
                        {mealName(m, options)}
                        {m.portion !== 1 && <i className="mx-logged-p">× {portionLabel(m.portion)}</i>}
                        {m.custom && <i className="mx-logged-off">fuera del plan</i>}
                      </div>
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

      <div className="mx-daytotal mx-mono">
        {(() => {
          const n = record?.meals?.length ?? 0
          return `${kcal(eaten)} kcal hoy · ${n} ${n === 1 ? 'comida registrada' : 'comidas registradas'}`
        })()}
      </div>

      {/* --- Cuerpo --- */}
      <div className="mx-card">
        <div className="mx-card-t"><div className="mx-eyebrow">Cuerpo</div></div>
        <Field label="Peso en ayunas" sub="Un valor al dia. El sistema usa la media de 7 dias.">
          <input
            className="mx-in"
            value={record?.weight != null ? String(record.weight) : ''}
            onChange={e => {
              const v = e.target.value
              app.updateRecord({ weight: v === '' ? undefined : parseFloat(v) }, viewDate)
            }}
            inputMode="decimal"
            placeholder="—"
          />
        </Field>
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
      </div>

      {/* --- Entrenamiento --- */}
      <div className="mx-card">
        <div className="mx-card-t">
          <div className="mx-eyebrow">Entrenamiento</div>
          <select
            className="mx-sel"
            value={workout?.id ?? ''}
            onChange={e => app.setWorkout(e.target.value || null, viewDate)}
          >
            <option value="">Descanso</option>
            {split.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {split.length === 0 ? (
          <div className="mx-empty">
            Todavia no tienes rutina. En <b>Mi plan → Entrenamiento</b> puedes cargar la ULPPL
            o armar la tuya.
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
                {sets.map((set, i) => (
                  <div key={i} className="mx-set">
                    <div className="mx-setn">Serie {i + 1}</div>
                    <input
                      className="mx-in"
                      value={set.weight}
                      onChange={e => app.setSet(ex.id, i, 'weight', e.target.value, viewDate)}
                      inputMode="decimal"
                      placeholder="—"
                    />
                    <input
                      className="mx-in"
                      value={set.reps}
                      onChange={e => app.setSet(ex.id, i, 'reps', e.target.value, viewDate)}
                      inputMode="numeric"
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* --- Sueno --- */}
      <div className="mx-card">
        <div className="mx-card-t">
          <div className="mx-eyebrow">Sueno</div>
          <div className="mx-mono mx-sleep" >
            {hours !== null ? `${hours} h` : '—'}
          </div>
        </div>
        <Field label="Me acoste" sub="Si fue despues de medianoche, cuenta para ayer">
          <input
            className="mx-in"
            type="time"
            value={record?.bedTime ?? ''}
            onChange={e => app.updateRecord({ bedTime: e.target.value || undefined }, viewDate)}
          />
        </Field>
        <Field label="Me desperte">
          <input
            className="mx-in"
            type="time"
            value={record?.wakeTime ?? ''}
            onChange={e => app.updateRecord({ wakeTime: e.target.value || undefined }, viewDate)}
          />
        </Field>
      </div>

      {picking && (
        <MealPicker
          open
          slot={picking}
          options={options}
          reference={slotReference(state.settings, picking)}
          onClose={() => setPicking(null)}
          onPick={(optionId, portion) => {
            app.logMeal(picking, optionId, portion, viewDate)
            setToast(`${SLOT_LABEL[picking]} registrado`)
            setPicking(null)
          }}
          onCustom={(custom, portion) => {
            app.logCustomMeal(picking, custom, portion, viewDate)
            setToast(`${SLOT_LABEL[picking]} registrado`)
            setPicking(null)
          }}
        />
      )}

      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title="Ajustar comida">
        {editing && (
          <>
            <div className="mx-lbl">{mealName(editing, options)}</div>
            <div className="mx-sub" style={{ marginBottom: 14 }}>
              {(() => {
                const m = roundMacros(mealMacros(editing, options))
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
    </>
  )
}
