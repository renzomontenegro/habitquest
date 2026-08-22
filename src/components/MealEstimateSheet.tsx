import { useRef, useState } from 'react'
import type { Macros, MealSlot } from '../types'
import { estimateMeal, type MealEstimate } from '../lib/sync'
import { SLOT_LABEL } from '../lib/config'
import { BottomSheet, MonoInput } from '../components/ui'

const MAX_PHOTOS = 5

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

/**
 * Registro de comida por fotos + texto. La IA (n8n + Opencode GO) estima los
 * macros; las fotos no se guardan en ningun lado (maximo 5).
 */
export function MealEstimateSheet({ open, slot, reference, onClose, onSave }: {
  open: boolean
  slot: MealSlot
  reference: Macros | null  // que deberia llevar esta comida segun el reparto
  onClose: () => void
  onSave: (custom: { name: string; prot: number; carb: number; grasa: number }, note: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<string[]>([])   // dataURLs para preview
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle')
  const [result, setResult] = useState<MealEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <BottomSheet open={open} onClose={onClose} title={`Registrar ${SLOT_LABEL[slot].toLowerCase()}`}>
      <div className="mx-sub" style={{ marginBottom: 12, lineHeight: 1.5 }}>
        Fotos + descripcion ({MAX_PHOTOS} max). La IA estima los macros y se guarda el resultado;
        las fotos no se almacenan.
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
        <div>
          <button className="mx-btn" data-p="1" onClick={() => fileRef.current?.click()}>
            Agregar fotos
          </button>
          <div className="mx-sub" style={{ marginTop: 8 }}>
            Tomar con la camara o elegir de la galeria. La comida puede estar en varias fotos.
          </div>
        </div>
      ) : (
        <div className="mx-photos">
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

      <div className="mx-lbl" style={{ margin: '14px 0 2px' }}>Comentario (opcional)</div>
      <MonoInput
        value={note}
        onChange={setNote}
        placeholder="Ej: doble porcion, con queso"
        className="mx-in-full"
      />

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
              onClick={() => {
                onSave(
                  { name: result?.nombre || 'Comida', prot: result?.prot ?? 0, carb: result?.carb ?? 0, grasa: result?.grasa ?? 0 },
                  note,
                )
                onClose()
              }}
            >
              Guardar
            </button>
            <button className="mx-btn" onClick={() => { setStatus('idle'); setResult(null) }}>
              Editar
            </button>
          </>
        ) : (
          <button
            className="mx-btn" data-p="1"
            disabled={photos.length === 0 || status === 'working'}
            onClick={estimar}
          >
            {status === 'working' ? 'Estimando...' : 'Estimar macros'}
          </button>
        )}
      </div>
    </BottomSheet>
  )
}