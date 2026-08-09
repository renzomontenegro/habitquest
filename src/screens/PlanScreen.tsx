import { useState } from 'react'
import type { AppController } from '../hooks/useAppState'
import type { Exercise, Macros, MealOption, MealSlot, SplitDay } from '../types'
import { addMacros, kcal, optionsForSlot, roundMacros, shortDate, slotReference, uid, ZERO } from '../lib/logic'
import { MACRO_LABEL, SLOTS, WEEKDAY_NAMES } from '../lib/config'
import { BottomSheet, ConfirmButton, MonoInput, Stepper, Toast } from '../components/ui'

function Fold({ title, meta, open, onToggle, children }: {
  title: string
  meta?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mx-card">
      <button className="mx-fold" onClick={onToggle}>
        <div>
          <div className="mx-eyebrow">{title}</div>
          {meta && <div className="mx-sub" style={{ marginTop: 3 }}>{meta}</div>}
        </div>
        <div className="mx-mini" style={{ pointerEvents: 'none' }}>{open ? 'Cerrar' : 'Abrir'}</div>
      </button>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  )
}

export function PlanScreen({ app }: { app: AppController }) {
  const settings = app.state.settings
  const { options, split, targets, slotShare } = settings

  // Las secciones que estan vacias arrancan abiertas: son las que necesitan
  // atencion, y su estado vacio es donde vive el boton para llenarlas.
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    comidas: true,
    objetivo: false,
    finos: false,
    meta: settings.targetWeight == null,
    entreno: split.length === 0,
  }))
  const [toast, setToast] = useState<string | null>(null)
  const [editor, setEditor] = useState<MealOption | null>(null)
  const [dayEditor, setDayEditor] = useState<SplitDay | null>(null)

  const toggle = (id: string) => setOpen(o => ({ ...o, [id]: !o[id] }))

  const setTarget = (key: keyof Macros, v: number) => {
    app.setTargets({ ...targets, [key]: Math.max(0, Math.round(v)) })
  }

  // Un dia "tipico": la opcion favorita de cada comida principal.
  const typical = (['desayuno', 'almuerzo', 'cena'] as MealSlot[]).reduce((acc, slot) => {
    const fav = optionsForSlot(options, slot)[0]
    return fav ? addMacros(acc, { prot: fav.prot, carb: fav.carb, grasa: fav.grasa }) : acc
  }, ZERO)
  const typicalR = roundMacros(typical)

  const weekly = { prot: targets.prot * 7, carb: targets.carb * 7, grasa: targets.grasa * 7 }

  return (
    <>
      {/* --- Mis comidas --- */}
      <Fold
        title="Mis comidas"
        meta={`${options.length} ${options.length === 1 ? 'opcion' : 'opciones'} · cada una con sus macros`}
        open={open.comidas}
        onToggle={() => toggle('comidas')}
      >
        <div className="mx-sub" style={{ marginBottom: 12, lineHeight: 1.5 }}>
          Registrar es elegir una de estas. La estrella marca la que sale primero en cada comida.
        </div>

        {SLOTS.map(s => {
          const list = optionsForSlot(options, s.id)
          return (
            <div key={s.id} className="mx-group">
              <div className="mx-group-h">
                <div className="mx-eyebrow">{s.label}</div>
                <span />
              </div>
              {list.length === 0 && <div className="mx-empty">Sin opciones todavia.</div>}
              {list.map(o => (
                <div key={o.id} className="mx-row">
                  <button
                    className="mx-star"
                    data-on={o.fav ? '1' : '0'}
                    onClick={() => app.toggleFav(o.id)}
                    aria-label={o.fav ? `Quitar ${o.name} de favoritos` : `Marcar ${o.name} como favorita`}
                  >
                    {o.fav ? '★' : '☆'}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div className="mx-lbl">{o.name}</div>
                    <div className="mx-sub mx-mono">
                      {Math.round(o.prot)}P · {Math.round(o.carb)}C · {Math.round(o.grasa)}G ·{' '}
                      {kcal({ prot: o.prot, carb: o.carb, grasa: o.grasa })} kcal
                    </div>
                  </div>
                  <button className="mx-mini" onClick={() => setEditor({ ...o, slots: [...o.slots] })}>Editar</button>
                </div>
              ))}
              <button
                className="mx-add"
                onClick={() => setEditor({ id: uid('o'), name: '', slots: [s.id], ...slotReference(settings, s.id) })}
              >
                + Agregar opcion de {s.label.toLowerCase()}
              </button>
            </div>
          )
        })}

        <div className="mx-total">
          <div className="mx-eyebrow" style={{ marginBottom: 6 }}>Un dia con tus favoritas</div>
          <div className="mx-mono" style={{ fontSize: 12.5 }}>
            {typicalR.prot}P · {typicalR.carb}C · {typicalR.grasa}G
            <span style={{ color: 'var(--mute)' }}> vs objetivo {targets.prot}P · {targets.carb}C · {targets.grasa}G</span>
          </div>
          <div className="mx-sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
            Si esto no cuadra con tu objetivo, el plan no cierra: ajusta los macros de las
            opciones o el objetivo.
          </div>
        </div>
      </Fold>

      {/* --- Objetivo diario --- */}
      <Fold
        title="Objetivo diario"
        meta={`${targets.prot} P · ${targets.carb} C · ${targets.grasa} G · ${kcal(targets)} kcal`}
        open={open.objetivo}
        onToggle={() => toggle('objetivo')}
      >
        {(['prot', 'carb', 'grasa'] as const).map(k => (
          <div key={k} className="mx-row">
            <div style={{ flex: 1 }}>
              <div className="mx-lbl">{MACRO_LABEL[k]}</div>
              <div className="mx-sub">{weekly[k]} g a la semana</div>
            </div>
            <Stepper value={targets[k]} onChange={v => setTarget(k, v)} step={5} suffix="g" />
          </div>
        ))}
        <div className="mx-sub" style={{ marginTop: 12, lineHeight: 1.55 }}>
          La semana suma contra estos numeros por 7. Un dia bajo se compensa con uno alto:
          lo que decide es el acumulado.
        </div>

        <div className="mx-eyebrow" style={{ margin: '20px 0 2px' }}>Reparto por comida</div>
        <div className="mx-sub" style={{ marginBottom: 6, lineHeight: 1.5 }}>
          Cuanto del dia va en cada comida. Es lo que se precarga al crear una opcion nueva
          o al registrar algo fuera del plan.
        </div>
        {SLOTS.map(s => {
          const ref = slotReference(settings, s.id)
          return (
            <div key={s.id} className="mx-row">
              <div style={{ flex: 1 }}>
                <div className="mx-lbl">{s.label}</div>
                <div className="mx-sub mx-mono">{ref.prot}P · {ref.carb}C · {ref.grasa}G</div>
              </div>
              <Stepper
                value={Math.round((slotShare[s.id] ?? 0) * 100)}
                onChange={v => app.updateSettings({
                  slotShare: { ...slotShare, [s.id]: Math.min(100, Math.max(0, Math.round(v))) / 100 },
                })}
                step={5}
                suffix="%"
              />
            </div>
          )
        })}
      </Fold>

      {/* --- Ajustes finos --- */}
      <Fold
        title="Ajustes finos"
        meta={`Sueno ${settings.sleepTarget} h · margen ±${Math.round(settings.tolerance * 100)}%`}
        open={open.finos}
        onToggle={() => toggle('finos')}
      >
        <div className="mx-row">
          <div style={{ flex: 1 }}>
            <div className="mx-lbl">Horas de sueno objetivo</div>
            <div className="mx-sub">Es la linea de referencia del grafico de sueno.</div>
          </div>
          <Stepper
            value={settings.sleepTarget}
            onChange={v => app.updateSettings({ sleepTarget: Math.min(14, Math.max(1, v)) })}
            step={0.5}
            min={1}
            suffix="h"
          />
        </div>
        <div className="mx-row">
          <div style={{ flex: 1 }}>
            <div className="mx-lbl">Margen para dar un dia por cumplido</div>
            <div className="mx-sub">
              Con ±{Math.round(settings.tolerance * 100)}%, hoy cuentan entre{' '}
              {Math.round(targets.prot * (1 - settings.tolerance))} y{' '}
              {Math.round(targets.prot * (1 + settings.tolerance))} g de proteina.
            </div>
          </div>
          <Stepper
            value={Math.round(settings.tolerance * 100)}
            onChange={v => app.updateSettings({ tolerance: Math.min(50, Math.max(1, Math.round(v))) / 100 })}
            step={1}
            min={1}
            suffix="%"
          />
        </div>
      </Fold>

      {/* --- Meta de peso --- */}
      <Fold
        title="Meta de peso"
        meta={settings.targetWeight != null && settings.targetDate
          ? `Bajar a ${settings.targetWeight} kg para ${shortDate(settings.targetDate)}`
          : 'Sin meta: fija a donde vas y para cuando'}
        open={open.meta}
        onToggle={() => toggle('meta')}
      >
        <div className="mx-sub" style={{ marginBottom: 12, lineHeight: 1.5 }}>
          La semana te dice si vas a llegar al ritmo actual. Con la tendencia de peso y esta meta,
          calcula cuantos kilos te faltan y cuanto te pasas o te quedas corto.
        </div>
        <div className="mx-row">
          <div style={{ flex: 1 }}>
            <div className="mx-lbl">Peso objetivo</div>
            <div className="mx-sub">A donde quieres llegar</div>
          </div>
          <Stepper
            value={settings.targetWeight ?? 0}
            onChange={v => app.updateSettings({ targetWeight: v > 0 ? v : undefined })}
            step={0.5}
            min={0}
            suffix="kg"
          />
        </div>
        <div className="mx-row">
          <div style={{ flex: 1 }}>
            <div className="mx-lbl">Fecha objetivo</div>
            <div className="mx-sub">La semana la usa para proyectar tu peso</div>
          </div>
          <input
            className="mx-in mx-date"
            type="date"
            value={settings.targetDate ?? ''}
            onChange={e => app.updateSettings({ targetDate: e.target.value || undefined })}
          />
        </div>
      </Fold>

      {/* --- Entrenamiento --- */}
      <Fold
        title="Entrenamiento"
        meta={`${split.length} ${split.length === 1 ? 'dia' : 'dias'} · ${split.reduce((n, d) => n + d.exercises.length, 0)} ejercicios`}
        open={open.entreno}
        onToggle={() => toggle('entreno')}
      >
        {split.length === 0 ? (
          <div className="mx-empty-cta">
            <div className="mx-lbl">Todavia no tienes rutina</div>
            <p>
              Puedes cargar la ULPPL de siempre (Upper / Lower / Push / Pull / Legs, 23
              ejercicios) y editar lo que quieras, o armar la tuya desde cero.
            </p>
            <button
              className="mx-btn" data-p="1"
              onClick={() => { app.loadRoutineTemplate(); setToast('Rutina cargada') }}
            >
              Cargar rutina ULPPL
            </button>
          </div>
        ) : (
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Cada dia puede quedar fijo a un dia de la semana. Los que no lo tengan solo apareceran
            si los eliges a mano en Hoy.
          </div>
        )}
        {split.map(d => (
          <div key={d.id} className="mx-row">
            <div style={{ flex: 1 }}>
              <div className="mx-lbl">{d.name}</div>
              <div className="mx-sub">
                {d.weekday !== null ? WEEKDAY_NAMES[d.weekday] : 'Sin dia fijo'} · {d.exercises.length} ejercicios
              </div>
            </div>
            <button
              className="mx-mini"
              onClick={() => setDayEditor({ ...d, exercises: d.exercises.map(e => ({ ...e })) })}
            >
              Editar
            </button>
          </div>
        ))}
        <button
          className="mx-add"
          onClick={() => setDayEditor({ id: uid('s'), name: '', weekday: null, exercises: [] })}
        >
          + Agregar dia
        </button>

        {split.length > 0 && (
          <div className="mx-total">
            <div className="mx-sub" style={{ lineHeight: 1.5 }}>
              Tambien puedes cargar la rutina ULPPL. Se agrega a lo que ya tengas: los dias que
              ya existan se saltan.
            </div>
            <button
              className="mx-mini"
              style={{ marginTop: 10 }}
              onClick={() => { app.loadRoutineTemplate(); setToast('Rutina cargada') }}
            >
              Cargar rutina ULPPL
            </button>
          </div>
        )}
      </Fold>

      {editor && (
        <OptionEditorSheet
          option={editor}
          existing={options.some(o => o.id === editor.id)}
          targets={targets}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={o => { app.upsertOption(o); setEditor(null); setToast('Comida guardada') }}
          onDelete={id => { app.removeOption(id); setEditor(null); setToast('Comida eliminada') }}
        />
      )}

      {dayEditor && (
        <SplitEditorSheet
          day={dayEditor}
          existing={split.some(d => d.id === dayEditor.id)}
          onChange={setDayEditor}
          onClose={() => setDayEditor(null)}
          onSave={d => { app.upsertSplitDay(d); setDayEditor(null); setToast('Dia guardado') }}
          onDelete={id => { app.removeSplitDay(id); setDayEditor(null); setToast('Dia eliminado') }}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  )
}

// --- Editor de opcion de comida ---
function OptionEditorSheet({ option, existing, targets, onChange, onClose, onSave, onDelete }: {
  option: MealOption
  existing: boolean
  targets: Macros
  onChange: (o: MealOption) => void
  onClose: () => void
  onSave: (o: MealOption) => void
  onDelete: (id: string) => void
}) {
  const valid = option.name.trim().length > 0 && option.slots.length > 0
  const m = { prot: option.prot, carb: option.carb, grasa: option.grasa }

  const toggleSlot = (slot: MealSlot) => {
    const has = option.slots.includes(slot)
    const slots = has ? option.slots.filter(s => s !== slot) : [...option.slots, slot]
    onChange({ ...option, slots })
  }

  const pct = (k: keyof Macros) => (targets[k] > 0 ? Math.round((option[k] / targets[k]) * 100) : 0)

  return (
    <BottomSheet open onClose={onClose} title={existing ? 'Editar comida' : 'Nueva comida'} wide>
      <div className="mx-lbl" style={{ marginBottom: 4 }}>Nombre</div>
      <MonoInput
        value={option.name}
        onChange={v => onChange({ ...option, name: v })}
        placeholder="Ej: Seco de res"
        className="mx-in-full"
      />

      <div className="mx-lbl" style={{ margin: '16px 0 6px' }}>En que comidas aparece</div>
      <div className="mx-chips">
        {SLOTS.map(s => (
          <button
            key={s.id}
            data-on={option.slots.includes(s.id) ? '1' : '0'}
            onClick={() => toggleSlot(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mx-eyebrow" style={{ margin: '18px 0 2px' }}>Macros de una porcion</div>
      {(['prot', 'carb', 'grasa'] as const).map(k => (
        <div key={k} className="mx-row">
          <div style={{ flex: 1 }}>
            <div className="mx-lbl">{MACRO_LABEL[k]}</div>
            <div className="mx-sub">{pct(k)}% de tu objetivo diario</div>
          </div>
          <Stepper
            value={option[k]}
            onChange={v => onChange({ ...option, [k]: Math.max(0, v) })}
            step={k === 'prot' ? 5 : k === 'carb' ? 5 : 2}
            suffix="g"
          />
        </div>
      ))}

      <div className="mx-total mx-mono">Una porcion: {kcal(m)} kcal</div>

      <div className="mx-acts">
        <button className="mx-btn" data-p="1" disabled={!valid} onClick={() => onSave({ ...option, name: option.name.trim() })}>
          Guardar
        </button>
        {existing && <ConfirmButton label="Eliminar" confirmLabel="Confirmar" onConfirm={() => onDelete(option.id)} />}
        <button className="mx-btn" onClick={onClose}>Cancelar</button>
      </div>
      {existing && (
        <div className="mx-sub" style={{ marginTop: 8 }}>
          Los dias en que ya la registraste dejan de sumar sus macros si la eliminas.
        </div>
      )}
    </BottomSheet>
  )
}

// --- Editor de dia de split ---
function SplitEditorSheet({ day, existing, onChange, onClose, onSave, onDelete }: {
  day: SplitDay
  existing: boolean
  onChange: (d: SplitDay) => void
  onClose: () => void
  onSave: (d: SplitDay) => void
  onDelete: (id: string) => void
}) {
  const valid = day.name.trim().length > 0

  const patchEx = (i: number, patch: Partial<Exercise>) => {
    onChange({ ...day, exercises: day.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= day.exercises.length) return
    const list = [...day.exercises]
    ;[list[i], list[j]] = [list[j], list[i]]
    onChange({ ...day, exercises: list })
  }

  return (
    <BottomSheet open onClose={onClose} title={existing ? 'Editar dia' : 'Nuevo dia'} wide>
      <div className="mx-lbl" style={{ marginBottom: 4 }}>Nombre del dia</div>
      <MonoInput value={day.name} onChange={v => onChange({ ...day, name: v })} placeholder="Ej: Push" className="mx-in-full" />

      <div className="mx-row" style={{ marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="mx-lbl">Dia de la semana</div>
          <div className="mx-sub">Se propone solo ese dia en Hoy</div>
        </div>
        <select
          className="mx-sel"
          value={day.weekday === null ? '' : String(day.weekday)}
          onChange={e => onChange({ ...day, weekday: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
        >
          <option value="">Sin dia fijo</option>
          {WEEKDAY_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
      </div>

      <div className="mx-eyebrow" style={{ margin: '16px 0 6px' }}>Ejercicios</div>
      {day.exercises.length === 0 && <div className="mx-empty">Sin ejercicios todavia.</div>}
      {day.exercises.map((ex, i) => (
        <div key={ex.id} className="mx-exed">
          <div className="mx-exed-top">
            <input
              className="mx-in mx-in-full"
              value={ex.name}
              onChange={e => patchEx(i, { name: e.target.value })}
              placeholder="Nombre del ejercicio"
            />
            <button
              className="mx-entry-x"
              onClick={() => onChange({ ...day, exercises: day.exercises.filter((_, j) => j !== i) })}
              aria-label={`Quitar ${ex.name || 'ejercicio'}`}
            >
              ✕
            </button>
          </div>
          <div className="mx-exed-bot">
            <label className="mx-exed-f">
              <span className="mx-sethd">Series</span>
              <input
                className="mx-in"
                value={String(ex.sets)}
                inputMode="numeric"
                onChange={e => {
                  const n = parseInt(e.target.value, 10)
                  patchEx(i, { sets: isNaN(n) ? 1 : Math.min(10, Math.max(1, n)) })
                }}
              />
            </label>
            <label className="mx-exed-f">
              <span className="mx-sethd">Reps</span>
              <input
                className="mx-in"
                value={ex.reps}
                onChange={e => patchEx(i, { reps: e.target.value })}
                placeholder="8-10"
              />
            </label>
            <div className="mx-exed-mv">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === day.exercises.length - 1} aria-label="Bajar">↓</button>
            </div>
          </div>
        </div>
      ))}
      <button
        className="mx-add"
        onClick={() => onChange({
          ...day,
          exercises: [...day.exercises, { id: uid('e'), name: '', sets: 3, reps: '8-10' }],
        })}
      >
        + Agregar ejercicio
      </button>

      <div className="mx-acts">
        <button
          className="mx-btn" data-p="1" disabled={!valid}
          onClick={() => onSave({
            ...day,
            name: day.name.trim(),
            exercises: day.exercises.filter(e => e.name.trim()).map(e => ({ ...e, name: e.name.trim() })),
          })}
        >
          Guardar
        </button>
        {existing && <ConfirmButton label="Eliminar dia" confirmLabel="Confirmar" onConfirm={() => onDelete(day.id)} />}
        <button className="mx-btn" onClick={onClose}>Cancelar</button>
      </div>
    </BottomSheet>
  )
}
