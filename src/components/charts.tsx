import { shortDate } from '../lib/logic'

/**
 * Grafico de linea con escala real. `values` puede tener huecos (null): la
 * linea se corta, no se inventa continuidad.
 */
export function LineChart({ points, unit, height = 96, band }: {
  points: { date: string; value: number | null }[]
  unit: string
  height?: number
  /** Linea de referencia opcional (p. ej. la media de 7 dias) */
  band?: number | null
}) {
  const known = points.filter(p => p.value !== null) as { date: string; value: number }[]
  if (known.length < 2) {
    return <div className="mx-empty">Necesitas al menos dos dias con datos para ver la tendencia.</div>
  }

  const W = 300
  const H = height
  const padL = 30
  const padB = 20 // sitio para las fechas sin que choquen con el valor del eje
  const padT = 8

  const vals = known.map(p => p.value)
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (band != null) { min = Math.min(min, band); max = Math.max(max, band) }
  // Un poco de aire para que la linea no toque los bordes.
  const pad = (max - min) * 0.15 || Math.max(0.5, max * 0.02)
  min -= pad
  max += pad
  const span = max - min || 1

  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL - 4)
  const y = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB)

  // Segmentos continuos: cada tramo sin huecos se dibuja por separado.
  const segments: string[] = []
  let current: string[] = []
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length > 1) segments.push(current.join(' '))
      current = []
    } else {
      current.push(`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    }
  })
  if (current.length > 1) segments.push(current.join(' '))

  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-svg" role="img" aria-label={`Tendencia en ${unit}`}>
      {[max, (max + min) / 2, min].map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - 4} y1={y(v)} y2={y(v)} className="mx-grid" />
          <text x={padL - 4} y={y(v) + 3} className="mx-axis" textAnchor="end">{fmt(v)}</text>
        </g>
      ))}

      {band != null && (
        <line x1={padL} x2={W - 4} y1={y(band)} y2={y(band)} className="mx-refline" />
      )}

      {segments.map((s, i) => (
        <polyline key={i} points={s} className="mx-line" />
      ))}

      {points.map((p, i) => p.value === null ? null : (
        <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 3 : 1.7} className="mx-dot" />
      ))}

      <text x={padL} y={H - 3} className="mx-axis">{shortDate(points[0].date)}</text>
      <text x={W - 4} y={H - 3} className="mx-axis" textAnchor="end">{shortDate(points[points.length - 1].date)}</text>
    </svg>
  )
}
