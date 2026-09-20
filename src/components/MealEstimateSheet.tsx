import { useRef, useState } from 'react'
import type { Macros, MealSlot, SavedMeal } from '../types'
import { estimateMeal, type MealEstimate } from '../lib/sync'
import { SLOT_LABEL } from '../lib/config'
import { BottomSheet, MonoInput } from '../components/ui'

const MAX_PHOTOS = 10

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('No se pudo leer la foto'))
    fr.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Formato no soportado: usa JPG o PNG'))
    img.src = src
  })
}

/** Comprime a JPEG (max 900 px, q0.72) y devuelve el base64 SIN prefijo. */
async function fileToB64(file: File): Promise<string> {
  const src = await readAsDataURL(file)
  const img = await loadImage(src)
  const MAX = 900
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la foto')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.72).replace(/^data:image\/jpeg;base64,/, '')
}

type View = 'capturar' | 'nombrar'

/**
 * Registro directo: descripcion y foto opcional en una sola vista. Las comidas
 * recurrentes se eligen desde el mismo formulario, sin una pantalla intermedia.
 */
export function MealEstimateSheet({ open, slot, reference, savedMeals, onClose, onSkip, onUseSaved, onEstimate, onSaveRecurring }: {
  open: boolean
  slot: MealSlot
  reference: Macros | null  // que deberia llevar esta comida segun el reparto
  savedMeals: SavedMeal[]
  onClose: () => void
  onSkip: () => void
  onUseSaved: (saved: SavedMeal) => void
  onEstimate: (custom: { name: string; prot: number; carb: number; grasa: number }, note: string) => void
  onSaveRecurring: (saved: SavedMeal) => void
}) {
  const [view, setView] = useState<View>('capturar')
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<string[]>([])   // dataURLs para preview
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<MealEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    try {
      const empty = MAX_PHOTOS - photos.length
      if (files.length > empty) throw new Error(`Maximo ${MAX_PHOTOS} fotos por comida.`)
      const b64s = await Promise.all(files.slice(0, empty).map(fileToB64))
      setPhotos(prev => [...prev, ...b64s.map(b => `data:image/jpeg;base64,${b}`)])
      setStatus('idle')
      setResult(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la foto')
    }
    e.target.value = ''
  }

  const removePhoto = (i: number) => {
    setPhotos(prev => prev.filter((_, j) => j !== i))
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  const estimar = async () => {
    if ((photos.length === 0 && !note.trim()) || status === 'working') return
    setStatus('working')
    setError(null)
    const images = photos.map(p => p.slice(p.indexOf(',') + 1))
    const { ok, data, error: estError } = await estimateMeal(slot, note, images)
    if (!ok || !data) {
      setStatus('idle')
      setError(estError ?? 'No se pudo estimar la comida.')
      return
    }
    setResult(data)
    setStatus('done')
  }

  const customOf = (r: MealEstimate) => ({ name: r.nombre || 'Comida', prot: r.prot, carb: r.carb, grasa: r.grasa })
  const updateNote = (value: string) => {
    setNote(value)
    if (status === 'done') {
      setStatus('idle')
      setResult(null)
    }
    setError(null)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Registrar ${SLOT_LABEL[slot].toLowerCase()}`}>
      {view === 'capturar' && (
        <>
          <div className="mx-lbl" style={{ margin: '0 0 5px' }}>¿Que comiste?</div>
          <div className="mx-meal-capture">
            <MonoInput
              value={note}
              onChange={updateNote}
              placeholder="Ej: hamburguesa doble con papas"
              className="mx-in-full"
              autoFocus
            />
            <button
              className="mx-camera-trigger"
              data-on={photos.length > 0 ? '1' : '0'}
              onClick={() => fileRef.current?.click()}
              aria-label={photos.length > 0 ? `Agregar otra foto. ${photos.length} adjuntas` : 'Adjuntar foto opcional'}
              title="Adjuntar foto opcional"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              {photos.length > 0 && <span>{photos.length}</span>}
            </button>
          </div>
          <div className="mx-sub" style={{ marginTop: 6 }}>
            El texto es suficiente. La foto ayuda, pero es opcional.
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onFiles}
          />

          {savedMeals.length > 0 && (
            <div className="mx-recurring-pick">
              <label className="mx-lbl" htmlFor={`recurrente-${slot}`}>O usa una comida recurrente</label>
              <select
                id={`recurrente-${slot}`}
                className="mx-select"
                defaultValue=""
                onChange={e => {
                  const saved = savedMeals.find(meal => meal.id === e.target.value)
                  if (saved) onUseSaved(saved)
                }}
              >
                <option value="" disabled>Elegir comida guardada...</option>
                {savedMeals.map(meal => <option key={meal.id} value={meal.id}>{meal.name}</option>)}
              </select>
            </div>
          )}

          {photos.length > 0 && (
            <div className="mx-photos" style={{ marginTop: 8 }}>
              {photos.map((p, i) => (
                <div key={i} className="mx-photo-th">
                  <img src={p} alt={`Comida ${i + 1}`} />
                  <button
                    className="mx-time-x"
                    onClick={() => removePhoto(i)}
                    aria-label={`Quitar foto ${i + 1}`}
                  >✕</button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button className="mx-photo-add" onClick={() => fileRef.current?.click()} aria-label="Agregar foto">
                  +
                </button>
              )}
            </div>
          )}

          {reference && (
            <div className="mx-sub mx-mono" style={{ marginTop: 8 }}>
              Referencia del plan: {reference.prot}P · {reference.carb}C · {reference.grasa}G
            </div>
          )}

          {error && <div className="mx-sub" style={{ color: 'var(--bad)', marginTop: 10 }}>{error}</div>}

          {status === 'working' && (
            <div className="mx-sub" style={{ marginTop: 14 }}>Estimando con IA... suele tardar 1-2 min.</div>
          )}

          {status === 'done' && result && (
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
              <div className="mx-lbl">{result.nombre || 'Comida'}</div>
              <div className="mx-mono" style={{ fontSize: 18, margin: '4px 0' }}>
                {result.prot}P · {result.carb}C · {result.grasa}G
              </div>
              <div className="mx-sub">{result.kcal} kcal · estimado por IA</div>
            </div>
          )}

          <div className="mx-acts">
            {status === 'done' ? (
              <>
                <button
                  className="mx-btn" data-p="1"
                  onClick={() => { onEstimate(customOf(result!), note); onClose() }}
                >
                  Guardar
                </button>
                <button
                  className="mx-btn"
                  onClick={() => {
                    setName(result?.nombre || 'Comida')
                    setView('nombrar')
                  }}
                >
                  Guardar como recurrente
                </button>
              </>
            ) : (
              <>
                <button
                  className="mx-btn" data-p="1"
                  disabled={(photos.length === 0 && !note.trim()) || status === 'working'}
                  onClick={estimar}
                >
                  {status === 'working' ? 'Estimando...' : 'Estimar macros'}
                </button>
                <button
                  className="mx-btn"
                  disabled={status === 'working'}
                  onClick={() => { onSkip(); onClose() }}
                >
                  No comi
                </button>
              </>
            )}
          </div>
        </>
      )}

      {view === 'nombrar' && (
        <>
          <div className="mx-lbl" style={{ margin: '0 0 2px' }}>¿Como te gustaria guardarla?</div>
          <MonoInput
            value={name}
            onChange={setName}
            placeholder="Ej: Batido de proteina"
            className="mx-in-full"
            autoFocus
          />
          {result && (
            <div className="mx-sub mx-mono" style={{ marginTop: 8 }}>
              {result.prot}P · {result.carb}C · {result.grasa}G · {result.kcal} kcal
            </div>
          )}
          <div className="mx-acts">
            <button
              className="mx-btn" data-p="1"
              disabled={name.trim().length === 0}
              onClick={() => {
                const saved = {
                  id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  name: name.trim(),
                  prot: result?.prot ?? 0,
                  carb: result?.carb ?? 0,
                  grasa: result?.grasa ?? 0,
                  ...(note ? { note } : {}),
                }
                onSaveRecurring(saved)
                onEstimate(customOf(result!), note)
                onClose()
              }}
            >
              Guardar
            </button>
            <button className="mx-btn" onClick={() => setView('capturar')}>← Volver</button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}