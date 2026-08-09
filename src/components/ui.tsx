import { useId, useEffect, useState, cloneElement, type ReactElement } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SaveStatus } from '../lib/sync'

// --- Bottom sheet ---
export function BottomSheet({ open, onClose, title, children, wide }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 420 }}
            animate={{ y: 0 }}
            exit={{ y: 420 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="mx-sheet"
            data-wide={wide ? '1' : '0'}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-sheet-grab" />
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
