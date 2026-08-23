import { useState } from 'react'
import type { MealSlot } from '../types'
import { suggestIdeas, type IdeaContext, type MealIdea } from '../lib/sync'
import { PROTEINS, SLOT_LABEL } from '../lib/config'
import { BottomSheet } from '../components/ui'

type Step = 'protein' | 'source' | 'ideas'

/**
 * Asistente de idea de comida: eliges la proteina base, cocinar o rappi, y la
 * IA sugiere 3-4 ideas peruanas con macros calculados. Una idea elegida se
 * registra como comida normal (ai).
 */
export function MealIdeaSheet({ open, slot, context, onClose, onUse }: {
  open: boolean
  slot: MealSlot
  context: Omit<IdeaContext, 'slot' | 'protein' | 'source'>
  onClose: () => void
  onUse: (custom: { name: string; prot: number; carb: number; grasa: number }, note: string) => void
}) {
  const [step, setStep] = useState<Step>('protein')
  const [protein, setProtein] = useState<string>('Cualquiera')
  const [source, setSource] = useState<'cocinar' | 'rappi'>('cocinar')
  const [status, setStatus] = useState<'idle' | 'working'>('idle')
  const [ideas, setIdeas] = useState<MealIdea[]>([])
  const [error, setError] = useState<string | null>(null)

  const title = `Ideas para ${SLOT_LABEL[slot].toLowerCase()}`

  const pedir = async () => {
    setStatus('working')
    setError(null)
    const { ok, ideas: list, error: e } = await suggestIdeas({ slot, protein, source, ...context })
    if (!ok || !list) {
      setStatus('idle')
      setError(e ?? 'No se pudieron pedir las ideas.')
      return
    }
    setIdeas(list)
    setStatus('idle')
    setStep('ideas')
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {step === 'protein' && (
        <>
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Que proteina vas a comer?
          </div>
          <div className="mx-chips">
            <button
              className="mx-chip"
              data-on={protein === 'Cualquiera' ? '1' : '0'}
              onClick={() => { setProtein('Cualquiera'); setStep('source') }}
            >
              Cualquiera
            </button>
            {PROTEINS.map(p => (
              <button
                key={p}
                className="mx-chip"
                data-on={protein === p ? '1' : '0'}
                onClick={() => { setProtein(p); setStep('source') }}
              >
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'source' && (
        <>
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            {protein} en tu {SLOT_LABEL[slot].toLowerCase()}. Lo cocinas tu o lo pides?
          </div>
          <div className="mx-acts">
            <button
              className="mx-btn"
              data-p={source === 'cocinar' ? '1' : '0'}
              disabled={status === 'working'}
              onClick={() => { setSource('cocinar'); void pedir() }}
            >
              🍳 Cocinar
            </button>
            <button
              className="mx-btn"
              data-p={source === 'rappi' ? '1' : '0'}
              disabled={status === 'working'}
              onClick={() => { setSource('rappi'); void pedir() }}
            >
              🛵 Rappi
            </button>
          </div>
          {status === 'working' && (
            <div className="mx-sub" style={{ marginTop: 10 }}>
              Pidiendo ideas a la IA... suele tardar 1-2 min.
            </div>
          )}
          <button
            className="mx-mini"
            style={{ marginTop: 10 }}
            disabled={status === 'working'}
            onClick={() => setStep('protein')}
          >
            ← Volver a proteinas
          </button>
        </>
      )}

      {step === 'ideas' && (
        <>
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            {protein} · {source === 'cocinar' ? 'para cocinar' : 'para pedir en Rappi'}. Toca una para
            registrarla.
          </div>
          <div className="mx-saved-list">
            {ideas.map((idea, i) => (
              <div key={i} className="mx-saved">
                <button
                  className="mx-saved-b"
                  onClick={() => {
                    onUse({ name: idea.nombre, prot: idea.prot, carb: idea.carb, grasa: idea.grasa }, idea.detalle)
                    onClose()
                  }}
                >
                  <div className="mx-logged-n"><span className="mx-logged-name">{idea.nombre}</span></div>
                  {idea.detalle && <div className="mx-logged-note">{idea.detalle}</div>}
                  <div className="mx-logged-m mx-mono">
                    <span>{idea.prot}P</span><span>{idea.carb}C</span><span>{idea.grasa}G</span>
                    <span>{idea.kcal} kcal</span>
                  </div>
                </button>
              </div>
            ))}
          </div>

          <div className="mx-acts">
            {status === 'working' && <div className="mx-sub">Pidiendo ideas a la IA...</div>}
            <button
              className="mx-btn" data-p="1"
              disabled={status === 'working'}
              onClick={() => pedir()}
            >
              Nuevas ideas
            </button>
            <button className="mx-btn" onClick={() => setStep('source')}>← Cambiar</button>
          </div>
        </>
      )}

      {error && <div className="mx-sub" style={{ color: 'var(--bad)', marginTop: 10 }}>{error}</div>}
    </BottomSheet>
  )
}
