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

type View = 'elegir' | 'repetidas' | 'foto' | 'nombrar'

/**
 * Registro de comida: primero eliges entre repetida (0 tokens) o una nueva
 * (foto + comentario -> IA). Al guardar una repetida pides el nombre.
 */
export function MealEstimateSheet({ open, slot, reference, savedMeals, onClose, onUseSaved, onEstimate, onSaveRecurring }: {
  open: boolean
  slot: MealSlot
  reference: Macros | null  // que deberia llevar esta comida segun el reparto
  savedMeals: SavedMeal[]
  onClose: () => void
  onUseSaved: (saved: SavedMeal) => void
  onEstimate: (custom: { name: string; prot: number; carb: number; grasa: number }, note: string) => void
  onSaveRecurring: (saved: SavedMeal) => void
}) {
  const [view, setView] = useState<View>('elegir')
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
    if (photos.length === 0 || status === 'working') return
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

  return (
    <BottomSheet open={open} onClose={onClose} title={`Registrar ${SLOT_LABEL[slot].toLowerCase()}`}>
      {view === 'elegir' && (
        <>
          <div className="mx-sub" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            ¿Como la registras?
          </div>
          <div className="mx-acts">
            {savedMeals.length > 0 && (
              <button className="mx-btn" data-p="1" onClick={() => setView('repetidas')}>
                🍽️ Comida repetida
              </button>
            )}
            <button className="mx-btn" onClick={() => setView('foto')}>
              📷 Nueva comida (IA)
            </button>
          </div>
          {savedMeals.length === 0 && (
            <div className="mx-sub" style={{ marginTop: 10, lineHeight: 1.5 }}>
              Para tener repetidas: registra una con foto y toca <b>Guardar como repetida</b>.
            </div>
          )}
        </>
      )}

      {view === 'repetidas' && (
        <>
          <div className="mx-sub" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Tus comidas guardadas. Se usan al toque, sin gastar IA.
          </div>
          {savedMeals.length === 0 ? (
            <div className="mx-empty">
              Todavia no tienes comidas guardadas. Registra una con foto y toca
              <b> Guardar como repetida</b> para tenerla aqui.
            </div>
          ) : (
            <div className="mx-saved-list">
              {savedMeals.map(m => (
                <div key={m.id} className="mx-saved">
                  <button className="mx-saved-b" onClick={() => onUseSaved(m)}>
                    <div className="mx-logged-n"><span className="mx-logged-name">{m.name}</span></div>
                    {m.note && <div className="mx-logged-note">{m.note}</div>}
                    <div className="mx-logged-m mx-mono">
                      <span>{m.prot}P</span><span>{m.carb}C</span><span>{m.grasa}G</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mx-acts">
            <button className="mx-btn" onClick={() => setView('elegir')}>← Volver</button>
          </div>
        </>
      )}

      {view === 'foto' && (
        <>
          <div className="mx-lbl" style={{ margin: '0 0 2px' }}>Comentario</div>
          <MonoInput
            value={note}
            onChange={setNote}
            placeholder="Ej: 400 gr de arroz + 200 gr de carne + 1 cucharada de aceite"
            className="mx-in-full"
          />

          <div className="mx-sub" style={{ margin: '12px 0 2px', lineHeight: 1.5 }}>
            <b>Tomale foto a la comida</b> (opcional: sin foto, la IA estima solo con el comentario).
            Si puedes, foto tambien a la <b>tabla nutricional</b> de los alimentos utilizados.
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onFiles}
          />

          {photos.length === 0 ? (
            <div style={{ marginTop: 8 }}>
              <button className="mx-btn" data-p="1" onClick={() => fileRef.current?.click()}>
                Agregar fotos
              </button>
              <div className="mx-sub" style={{ marginTop: 8 }}>
                Tomar con la camara o elegir de la galeria (hasta {MAX_PHOTOS}).
              </div>
            </div>
          ) : (
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
            <div className="mx-sub" style={{ marginTop: 14 }}>Estimando con IA... suele tardar unos 30 s.</div>
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
                  Guardar como repetida
                </button>
              </>
            ) : (
              <button
                className="mx-btn" data-p="1"
                disabled={(photos.length === 0 && !note.trim()) || status === 'working'}
                onClick={estimar}
              >
                {status === 'working' ? 'Estimando...' : 'Estimar macros'}
              </button>
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
                onSaveRecurring({
                  id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  name: name.trim(),
                  prot: result?.prot ?? 0,
                  carb: result?.carb ?? 0,
                  grasa: result?.grasa ?? 0,
                  ...(note ? { note } : {}),
                })
                setView('repetidas')
              }}
            >
              Guardar
            </button>
            <button className="mx-btn" onClick={() => setView('foto')}>← Volver</button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}