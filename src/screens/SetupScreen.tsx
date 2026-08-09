import { useState } from 'react'
import type { Macros } from '../types'
import { kcal } from '../lib/logic'
import { DEFAULT_TARGETS, MACRO_LABEL } from '../lib/config'
import { Stepper } from '../components/ui'

/**
 * Primer arranque. Lo unico imprescindible antes de poder registrar son los
 * objetivos: sin ellos las barras de Hoy no significan nada. Las comidas y la
 * rutina se crean despues, desde Mi plan.
 */
export function SetupScreen({ onDone }: { onDone: (targets: Macros) => void }) {
  const [targets, setTargets] = useState<Macros>({ ...DEFAULT_TARGETS })

  const set = (k: keyof Macros, v: number) =>
    setTargets(t => ({ ...t, [k]: Math.max(0, Math.round(v)) }))

  return (
    <div className="mx-setup">
      <div className="mx-eyebrow">Para empezar</div>
      <h2>Tus objetivos del dia</h2>
      <p>
        Es lo unico que la app necesita saber antes de que registres tu primera comida.
        Puedes cambiarlos cuando quieras desde Mi plan.
      </p>

      <div className="mx-card" style={{ marginTop: 18 }}>
        {(['prot', 'carb', 'grasa'] as const).map(k => (
          <div key={k} className="mx-row">
            <div style={{ flex: 1 }}>
              <div className="mx-lbl">{MACRO_LABEL[k]}</div>
              <div className="mx-sub">{targets[k] * 7} g a la semana</div>
            </div>
            <Stepper value={targets[k]} onChange={v => set(k, v)} step={5} suffix="g" />
          </div>
        ))}
        <div className="mx-total mx-mono">{kcal(targets)} kcal al dia</div>
      </div>

      <button className="mx-btn" data-p="1" style={{ width: '100%' }} onClick={() => onDone(targets)}>
        Empezar
      </button>

      <div className="mx-sub" style={{ marginTop: 12, lineHeight: 1.5 }}>
        Despues vas a crear tus comidas: cada una con sus macros, para que registrar
        sea elegir una y nada mas.
      </div>
    </div>
  )
}
