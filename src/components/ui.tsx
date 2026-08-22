import { useId, useEffect, useState, useRef, cloneElement, type ReactElement } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SaveStatus } from '../lib/sync'

// --- Bottom sheet (modal centrado con `center`) ---
export function BottomSheet({ open, onClose, title, children, wide, center }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
  center?: boolean
}) {
  // El teclado de iOS no debe dejar el sheet detras del contenido de la pagina.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex justify-center bg-black/40 ${center ? 'items-center' : 'items-end'}`}
          onClick={onClose}
        >
          <motion.div
            initial={center ? { y: 40, opacity: 0.6 } : { y: 420 }}
            animate={center ? { y: 0, opacity: 1 } : { y: 0 }}
            exit={center ? { y: 40, opacity: 0.6 } : { y: 420 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="mx-sheet"
            data-wide={wide ? '1' : '0'}
            data-center={center ? '1' : '0'}
            onClick={e => e.stopPropagation()}
          >
            {!center && <div className="mx-sheet-grab" />}
            <div className="mx-sheet-head">
              <div className="mx-eyebrow">{title}</div>
              <button className="mx-sheet-x" onClick={onClose} aria-label="Cerrar">✕</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Input mono ---
export function MonoInput({ value, onChange, placeholder, inputMode, className, autoFocus }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal'
  className?: string
  autoFocus?: boolean
}) {
  return (
    <input
      className={`mx-in ${className ?? ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode ?? 'text'}
      autoFocus={autoFocus}
    />
  )
}

// --- Fila con label / sub ---
export function Field({ label, sub, children }: {
  label: string
  sub?: string
  children: React.ReactNode
}) {
  const id = useId()
  const child = children as ReactElement | null
  const isInput = !!child && typeof child === 'object' && (child as ReactElement).type === 'input'
  return (
    <div className="mx-row">
      <div style={{ flex: 1 }}>
        <label className="mx-lbl" htmlFor={isInput ? id : undefined}>{label}</label>
        {sub && <div className="mx-sub">{sub}</div>}
      </div>
      {isInput ? cloneElement(child as ReactElement<{ id?: string }>, { id }) : children}
    </div>
  )
}

/**
 * Segmented control. `value` puede ser undefined: en ese caso NO se pinta
 * ninguna opcion, para que "sin responder" no parezca una respuesta.
 */
export function Seg({ opts, value, onChange }: {
  opts: string[]
  value: string | undefined
  onChange: (v: string) => void
}) {
  return (
    <div className="mx-seg" role="radiogroup" aria-label="Seleccionar opcion">
      {opts.map(o => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          data-on={value === o ? '1' : '0'}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// --- Stepper numerico: menos teclado, mas taps ---
export function Stepper({ value, onChange, step = 10, min = 0, suffix }: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  suffix?: string
}) {
  const clamp = (n: number) => Math.max(min, Math.round(n * 100) / 100)
  return (
    <div className="mx-stepper">
      <button onClick={() => onChange(clamp(value - step))} aria-label="Menos">−</button>
      <input
        className="mx-stepper-v mx-mono"
        value={String(value)}
        inputMode="decimal"
        onChange={e => {
          const n = parseFloat(e.target.value)
          onChange(isNaN(n) ? min : clamp(n))
        }}
      />
      {suffix && <span className="mx-stepper-u">{suffix}</span>}
      <button onClick={() => onChange(clamp(value + step))} aria-label="Mas">+</button>
    </div>
  )
}

// --- Barra de macro: lo que FALTA es el numero grande ---
export function MacroBar({ label, eaten, target, tone }: {
  label: string
  eaten: number
  target: number
  tone: 'prot' | 'carb' | 'grasa'
}) {
  const left = Math.round(target - eaten)
  const pct = target > 0 ? (eaten / target) * 100 : 0
  const over = pct > 105
  return (
    <div className="mx-mb" data-tone={tone} data-over={over ? '1' : '0'}>
      <div className="mx-eyebrow">{label}</div>
      <div className="mx-mb-v mx-mono">
        {left >= 0 ? left : `+${-left}`}<span className="mx-u">g</span>
      </div>
      <div className="mx-mb-t">{left >= 0 ? 'faltan' : 'te pasaste'}</div>
      <div className="mx-mb-track">
        <i style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mx-mb-n mx-mono">{Math.round(eaten)} / {Math.round(target)}</div>
    </div>
  )
}

// --- Indicador de guardado ---
const SAVE_TEXT: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Sin guardar',
  saving: 'Guardando',
  saved: 'Guardado',
  error: 'No se guardo',
}

export function SaveDot({ status, offline, onRetry }: {
  status: SaveStatus
  offline: boolean
  onRetry: () => void
}) {
  const state = offline ? 'offline' : status
  const text = offline ? 'Solo en este equipo' : SAVE_TEXT[status]
  if (!text) return null
  const clickable = state === 'error'
  return (
    <button
      className="mx-save"
      data-s={state}
      onClick={clickable ? onRetry : undefined}
      disabled={!clickable}
    >
      <i /> {text}{clickable ? ' · reintentar' : ''}
    </button>
  )
}

// --- Toast breve ---
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const id = setTimeout(onDone, 1600)
    return () => clearTimeout(id)
  }, [message, onDone])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="mx-toast"
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Confirmacion en dos pasos, sin window.confirm ---
export function ConfirmButton({ label, confirmLabel, onConfirm, className }: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(id)
  }, [armed])

  return (
    <button
      className={className ?? 'mx-btn mx-btn-danger'}
      onClick={() => { if (armed) { onConfirm(); setArmed(false) } else setArmed(true) }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}

// --- Rueda de repeticiones: 0-20, arranca en el limite inferior del rango ---
const REPS_COUNT = 21

export function RepsWheel({ open, onClose, title, initial, hasValue, onChange }: {
  open: boolean
  onClose: () => void
  title: string
  initial: number
  hasValue: boolean
  onChange: (v: number | undefined) => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {open && (
        <RepsBody initial={initial} hasValue={hasValue} onChange={onChange} onClose={onClose} />
      )}
    </BottomSheet>
  )
}

function RepsBody({ initial, hasValue, onChange, onClose }: {
  initial: number
  hasValue: boolean
  onChange: (v: number | undefined) => void
  onClose: () => void
}) {
  const [v, setV] = useState(Math.max(0, Math.min(REPS_COUNT - 1, Math.round(initial))))

  return (
    <>
      <div className="mx-wv mx-mono">{v} <span className="mx-u">reps</span></div>
      <div className="mx-wheel">
        <WheelCol label="Repeticiones" count={REPS_COUNT} selected={v} onSelect={setV} fmt={String} />
      </div>
      <div className="mx-acts">
        {hasValue && (
          <button
            className="mx-btn mx-btn-danger"
            onClick={() => { onChange(undefined); onClose() }}
          >
            Borrar
          </button>
        )}
        <button className="mx-btn" data-p="1" onClick={() => { onChange(v); onClose() }}>
          Listo
        </button>
      </div>
    </>
  )
}

// --- Rueda de hora estilo iOS (alarma) ---
// Dos columnas con scroll-snap siempre producen "HH:MM" valido: imposible que
// el record reciba un string que el input marque como invalido.
const WHEEL_ITEM = 44
const WHEEL_VISIBLE = 5
const WHEEL_PAD = Math.floor(WHEEL_VISIBLE / 2)

const pad2 = (n: number): string => String(n).padStart(2, '0')

// Pesaje con rueda: el entero se edita sobre un rango por unidad (kg o lb),
// en indices (count) y se traduce al valor al pintar y al elegir.
const DEC_COUNT = 10

function WheelCol({ label, count, selected, onSelect, fmt = pad2 }: {
  label: string
  count: number
  selected: number
  onSelect: (index: number) => void
  fmt?: (index: number) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastScrollIdx = useRef(-1)

  // Con solo saber si el cambio de `selected` vino del propio scroll no basta:
  // llegan varios eventos scroll entre renders y el flag queda "pegado", lo que
  // hacia que un cambio EXTERNO (cambiar kg/lb rapido) se salteara el scroll.
  // Aqui eso es imposible: si el ultimo scroll reporta justo `selected`, el
  // cambio es nuestro (consumir y no forzar); si no, vino de fuera y se posiciona.
  useEffect(() => {
    if (selected === lastScrollIdx.current) {
      lastScrollIdx.current = -1
      return
    }
    const el = ref.current
    if (el) el.scrollTop = selected * WHEEL_ITEM
  }, [selected])

  const go = (i: number) => {
    ref.current?.scrollTo({ top: i * WHEEL_ITEM, behavior: 'smooth' })
  }

  return (
    <div className="mx-wheel-col">
      <div
        ref={ref}
        className="mx-wheel-scroll"
        role="listbox"
        aria-label={label}
        style={{ height: WHEEL_ITEM * WHEEL_VISIBLE }}
        onScroll={() => {
          const el = ref.current
          const idx = el ? Math.round(el.scrollTop / WHEEL_ITEM) : selected
          lastScrollIdx.current = idx
          onSelect(Math.min(count - 1, Math.max(0, idx)))
        }}
      >
        <div
          className="mx-wheel-pad"
          style={{ paddingTop: WHEEL_PAD * WHEEL_ITEM, paddingBottom: WHEEL_PAD * WHEEL_ITEM }}
        >
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={i === selected}
              className="mx-wheel-item mx-mono"
              data-on={i === selected ? '1' : '0'}
              onClick={() => go(i)}
            >
              {fmt(i)}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-wheel-hl" />
      <div className="mx-wheel-fade" data-t="top" />
      <div className="mx-wheel-fade" data-t="bottom" />
    </div>
  )
}

export function TimeWheel({ open, onClose, title, value, onChange }: {
  open: boolean
  onClose: () => void
  title: string
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  const m = value?.match(/^(\d{1,2}):(\d{2})$/)
  const startH = m ? Math.min(23, parseInt(m[1], 10)) : 20
  const startM = m ? Math.min(59, parseInt(m[2], 10)) : 0

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {open && (
        <WheelBody
          startH={startH}
          startM={startM}
          hasValue={!!m}
          onChange={onChange}
          onClose={onClose}
        />
      )}
    </BottomSheet>
  )
}

// El cuerpo se monta solo al abrir, asi el estado arranca del valor del record
// sin necesidad de sincronizarlo con un effect.
function WheelBody({ startH, startM, hasValue, onChange, onClose }: {
  startH: number
  startM: number
  hasValue: boolean
  onChange: (v: string | undefined) => void
  onClose: () => void
}) {
  const [h, setH] = useState(startH)
  const [min, setMin] = useState(startM)

  const commit = () => onChange(`${pad2(h)}:${pad2(min)}`)

  return (
    <>
      <div className="mx-wheel">
        <WheelCol label="Horas" count={24} selected={h} onSelect={setH} fmt={i => pad2(i)} />
        <div className="mx-wheel-sep mx-mono">:</div>
        <WheelCol label="Minutos" count={60} selected={min} onSelect={setMin} fmt={i => pad2(i)} />
      </div>
      <div className="mx-acts">
        {hasValue && (
          <button
            className="mx-btn mx-btn-danger"
            onClick={() => { onChange(undefined); onClose() }}
          >
            Borrar
          </button>
        )}
        <button className="mx-btn" data-p="1" onClick={() => { commit(); onClose() }}>
          Listo
        </button>
      </div>
    </>
  )
}

// --- Pesaje con rueda: entero + decimal, en kg o lb, siempre se guarda en kg ---
const KG_TO_LB = 2.2046226218

const round1 = (n: number): number => Math.round(n * 10) / 10

export function WeightWheel({ open, onClose, title, initialKg, hasValue, onChange, minKg = 30, maxKg = 250 }: {
  open: boolean
  onClose: () => void
  title: string
  initialKg: number
  hasValue: boolean
  onChange: (v: number | undefined) => void
  minKg?: number
  maxKg?: number
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {open && (
        <WeightBody
          initialKg={initialKg}
          hasValue={hasValue}
          minKg={minKg}
          maxKg={maxKg}
          onChange={onChange}
          onClose={onClose}
        />
      )}
    </BottomSheet>
  )
}

function WeightBody({ initialKg, hasValue, minKg, maxKg, onChange, onClose }: {
  initialKg: number
  hasValue: boolean
  minKg: number
  maxKg: number
  onChange: (v: number | undefined) => void
  onClose: () => void
}) {
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg')
  const [draftKg, setDraftKg] = useState(round1(initialKg))
  const [text, setText] = useState(String(round1(initialKg)).replace('.', ','))
  const inputRef = useRef<HTMLInputElement>(null)

  // Unica fuente de verdad: kg. El lb es solo como se ve/edita.
  const inUnit = unit === 'kg' ? draftKg : draftKg * KG_TO_LB
  const rounded = Math.round(inUnit * 10) / 10
  const whole = Math.floor(rounded)
  const dec = Math.round((rounded - whole) * 10)

  const wholeMin = unit === 'kg' ? minKg : Math.max(1, Math.round(minKg * KG_TO_LB))
  const wholeMax = unit === 'kg' ? maxKg : Math.round(maxKg * KG_TO_LB)
  const wholeCount = wholeMax - wholeMin + 1
  const wholeIndex = Math.max(0, Math.min(wholeCount - 1, whole - wholeMin))

  const setInUnit = (v: number) => {
    const g = unit === 'kg' ? v : v / KG_TO_LB
    setDraftKg(Math.max(1, round1(g)))
    const disp = unit === 'kg' ? g : g * KG_TO_LB
    setText(String(Math.round(disp * 10) / 10).replace('.', ','))
  }

  // Cambiar kg/lb NUNCA toca el draft (que siempre es kg): solo refresca el
  // texto mostrado. Convertir de nuevo con el estado viejo hundia el valor.
  const toggleUnit = (v: 'kg' | 'lb') => {
    setUnit(v)
    const val = v === 'kg' ? draftKg : draftKg * KG_TO_LB
    setText(String(Math.round(val * 10) / 10).replace('.', ','))
  }

  const onType = (raw: string) => {
    setText(raw)
    const n = parseFloat(raw.replace(',', '.'))
    if (Number.isFinite(n) && n > 0) setDraftKg(Math.min(999, round1(unit === 'kg' ? n : n / KG_TO_LB)))
  }

  return (
    <div>
      <div className="mx-wv-center">
        <div className="mx-wv-container">
          <input
            ref={inputRef}
            className="mx-peso-in mx-mono"
            value={text}
            inputMode="decimal"
            aria-label="Peso en kg o lb"
            onChange={e => onType(e.target.value)}
          />
          <i className="mx-wv-u">{unit}</i>
          <button
            className="mx-edit-circle"
            onClick={() => { inputRef.current?.focus(); inputRef.current?.select() }}
            aria-label="Editar peso con teclado"
          >✎</button>
        </div>
      </div>
      <div className="mx-wv-seg">
        <Seg opts={['kg', 'lb']} value={unit} onChange={v => toggleUnit(v as 'kg' | 'lb')} />
      </div>
      <div className="mx-wheel">
        <WheelCol
          label="Enteros"
          count={wholeCount}
          selected={wholeIndex}
          onSelect={i => setInUnit(wholeMin + i)}
          fmt={i => String(wholeMin + i)}
        />
        <div className="mx-wheel-sep mx-mono">,</div>
        <WheelCol
          label="Decimales"
          count={DEC_COUNT}
          selected={dec}
          onSelect={d => setInUnit(whole + d * 0.1)}
          fmt={String}
        />
      </div>
      <div className="mx-acts">
        {hasValue && (
          <button
            className="mx-btn mx-btn-danger"
            onClick={() => { onChange(undefined); onClose() }}
          >
            Borrar
          </button>
        )}
        <button className="mx-btn" data-p="1" onClick={() => { onChange(round1(draftKg)); onClose() }}>
          Listo
        </button>
      </div>
    </div>
  )
}
