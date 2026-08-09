import { useMemo, useState } from 'react'
import type { Macros, MealOption, MealSlot } from '../types'
import { optionsForSlot, roundMacros, scaleMacros } from '../lib/logic'
import { PORTIONS, SLOT_LABEL } from '../lib/config'
import { BottomSheet, MonoInput } from './ui'

function portionLabel(p: number): string {
  if (p === 0.5) return '½'
  if (p === 1.5) return '1½'
  return String(p)
}

function Macro({ prot, carb, grasa }: { prot: number; carb: number; grasa: number }) {
  return (
    <div className="mx-opt-m mx-mono">
      <span>{prot}<em>P</em></span>
      <span>{carb}<em>C</em></span>
      <span>{grasa}<em>G</em></span>
    </div>
  )
}

interface Props {
  open: boolean
  slot: MealSlot
  options: MealOption[]
  /** Macros que le tocan a esta comida segun el objetivo del usuario. */
  reference: Macros
  onClose: () => void
  onPick: (optionId: string, portion: number) => void
  onCustom: (custom: { name: string; prot: number; carb: number; grasa: number }, portion: number) => void
}

export function MealPicker({ open, slot, options, reference, onClose, onPick, onCustom }: Props) {
  const [portion, setPortion] = useState(1)
  const [custom, setCustom] = useState<{ name: string; prot: string; carb: string; grasa: string } | null>(null)

  const mine = useMemo(() => optionsForSlot(options, slot), [options, slot])
  const others = useMemo(
    () => options.filter(o => !o.slots.includes(slot)),
    [options, slot],
  )

  const close = () => { setPortion(1); setCustom(null); onClose() }

  const pick = (o: MealOption) => {
    onPick(o.id, portion)
    setPortion(1)
    setCustom(null)
  }

  const openCustom = () => {
    setCustom({
      name: '',
      prot: String(reference.prot),
      carb: String(reference.carb),
      grasa: String(reference.grasa),
    })
  }

  const saveCustom = () => {
    if (!custom?.name.trim()) return
    onCustom({
      name: custom.name.trim(),
      prot: Math.max(0, parseFloat(custom.prot) || 0),
      carb: Math.max(0, parseFloat(custom.carb) || 0),
      grasa: Math.max(0, parseFloat(custom.grasa) || 0),
    }, portion)
    setPortion(1)
    setCustom(null)
  }

  const row = (o: MealOption) => {
    const m = roundMacros(scaleMacros({ prot: o.prot, carb: o.carb, grasa: o.grasa }, portion))
    return (
      <button key={o.id} className="mx-opt" onClick={() => pick(o)}>
        <div style={{ flex: 1 }}>
          <div className="mx-opt-n">{o.name}{o.fav && <i className="mx-opt-fav">★</i>}</div>
          <Macro {...m} />
        </div>
        <span className="mx-opt-add">+</span>
      </button>
    )
  }

  return (
    <BottomSheet open={open} onClose={close} title={SLOT_LABEL[slot]} wide>
      <div className="mx-portion">
        <span className="mx-eyebrow">Porcion</span>
        <div className="mx-seg">
          {PORTIONS.map(p => (
            <button key={p} data-on={portion === p ? '1' : '0'} onClick={() => setPortion(p)}>
              {portionLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {custom ? (
        <div className="mx-adjust">
          <div className="mx-lbl" style={{ marginBottom: 4 }}>Que comiste</div>
          <MonoInput
            value={custom.name}
            onChange={v => setCustom({ ...custom, name: v })}
            placeholder="Ej: Pollo a la brasa"
            className="mx-in-full"
            autoFocus
          />
          <div className="mx-sub" style={{ margin: '10px 0 8px' }}>
            Empieza con los macros de referencia de {SLOT_LABEL[slot].toLowerCase()}. Ajustalos a ojo.
          </div>
          <div className="mx-custom-m">
            {(['prot', 'carb', 'grasa'] as const).map(k => (
              <label key={k} className="mx-exed-f">
                <span className="mx-sethd">{k === 'prot' ? 'Prot' : k === 'carb' ? 'Carbo' : 'Grasa'}</span>
                <input
                  className="mx-in"
                  value={custom[k]}
                  inputMode="decimal"
                  onChange={e => setCustom({ ...custom, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="mx-acts">
            <button className="mx-btn" data-p="1" disabled={!custom.name.trim()} onClick={saveCustom}>
              Registrar
            </button>
            <button className="mx-btn" onClick={() => setCustom(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mx-list">
            {mine.length === 0 && (
              <div className="mx-empty">
                No tienes opciones para {SLOT_LABEL[slot].toLowerCase()}. Creala en Mi plan.
              </div>
            )}
            {mine.map(row)}
          </div>

          <button className="mx-add" onClick={openCustom}>Comi otra cosa</button>

          {others.length > 0 && (
            <>
              <div className="mx-eyebrow" style={{ margin: '18px 0 2px' }}>De otras comidas</div>
              <div className="mx-list">{others.map(row)}</div>
            </>
          )}
        </>
      )}
    </BottomSheet>
  )
}
