import { useMemo } from 'react'
import type { AppController } from '../hooks/useAppState'
import {
  addDays, adherence, foodLogCoverage, getRecord, getVerdict, hasCompleteFoodLog,
  lastNDates, shortDate, strengthDrops, waistSeries, weekDates, weightAvg, weightTrend,
} from '../lib/logic'
import { RULES, VERDICT_TEXT } from '../lib/config'
import { LineChart, Stat } from '../components/charts'

/**
 * Progreso que cambia decisiones. No repite cada dato registrado: muestra
 * huecos que corregir, tendencia corporal y alertas de fuerza.
 */
export function WeekScreen({ app, onSelectDate }: {
  app: AppController
  onSelectDate?: (date: string) => void
}) {
  const { state, today } = app
  const { split } = state.settings
  const records = state.records

  const week = useMemo(() => weekDates(today), [today])
  const verdict = getVerdict(records, state.settings)
  const verdictCopy = VERDICT_TEXT[verdict] ?? VERDICT_TEXT.ok
  const adherenceNow = useMemo(
    () => adherence(records, week, state.settings),
    [records, week, state.settings],
  )

  const pendingDates = useMemo(
    () => week.filter(date => date <= today && !hasCompleteFoodLog(getRecord(records, date))),
    [records, week, today],
  )

  const weightPoints = useMemo(() => {
    const dates = lastNDates(RULES.weightChartDays, today)
    return dates.map(date => ({ date, value: getRecord(records, date)?.weight ?? null }))
  }, [records, today])
  const avg7 = weightAvg(records, addDays(today, -6), today)
  const trend = weightTrend(records)
  const waist = useMemo(() => waistSeries(records, 90), [records])
  const drops = useMemo(() => strengthDrops(records, split), [records, split])

  if (records.length === 0) {
    return (
      <div className="mx-card">
        <div className="mx-eyebrow">El progreso empieza al trazar</div>
        <div className="mx-sub" style={{ marginTop: 8, lineHeight: 1.55 }}>
          Cierra tu primer día y registra algunos pesajes. Aquí aparecerán solo las tendencias útiles.
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mx-verdict" data-s={verdict}>
        <div>
          <div className="mx-eyebrow">Lectura semanal</div>
          <div className="mx-verdict-h">{verdictCopy.title}</div>
        </div>
        <div className="mx-verdict-n">{verdictCopy.note}</div>
      </div>

      {pendingDates.length > 0 && (
        <div className="mx-nudge">
          <div className="mx-lbl">{pendingDates.length} {pendingDates.length === 1 ? 'día necesita' : 'días necesitan'} cierre</div>
          <p>Sin cerrar comidas no se puede saber si cumpliste. Toca una fecha para completarla.</p>
          <div className="mx-pending-days">
            {pendingDates.map(date => {
              const coverage = foodLogCoverage(getRecord(records, date))
              return (
                <button key={date} onClick={() => onSelectDate?.(date)} disabled={!onSelectDate}>
                  <span>{date === today ? 'Hoy' : shortDate(date)}</span>
                  <small>{coverage.covered > 0 ? `${coverage.covered}/4 comidas` : 'sin comidas'}</small>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mx-three">
        <Stat label="Cerrados" value={`${adherenceNow.logged}`} unit="/7" sub="días evaluables" />
        <Stat
          label="En objetivo"
          value={`${adherenceNow.onTarget}`}
          unit={`/${adherenceNow.logged || 0}`}
          sub={`dentro de ±${Math.round(state.settings.tolerance * 100)}%`}
          tone={adherenceNow.logged > 0 && adherenceNow.onTarget >= adherenceNow.logged * RULES.onTargetShare ? 'good' : 'warn'}
        />
        <Stat
          label="Ritmo de peso"
          value={trend ? `${trend.delta > 0 ? '+' : ''}${trend.delta.toFixed(1)}` : '—'}
          unit={trend ? 'kg/sem' : undefined}
          sub="promedios de 7 días"
          tone={trend ? (trend.delta < 0 ? 'good' : 'warn') : 'mute'}
        />
      </div>

      <div className="mx-card">
        <div className="mx-card-t">
          <div className="mx-eyebrow">Peso · tendencia de {RULES.weightChartDays} días</div>
          <div className="mx-mono" style={{ fontSize: 12, fontWeight: 600 }}>
            {avg7 !== null ? `${avg7.toFixed(1)} kg prom.` : 'Faltan pesajes'}
          </div>
        </div>
        <LineChart points={weightPoints} unit="kg" band={avg7} height={110} />
        <div className="mx-legend">La línea horizontal es tu promedio actual de 7 días.</div>
      </div>

      {waist.length >= 2 && (
        <div className="mx-card">
          <div className="mx-card-t">
            <div className="mx-eyebrow">Cintura · cambio corporal</div>
            <div className="mx-mono" style={{ fontSize: 12, fontWeight: 600 }}>
              {waist[waist.length - 1].waist} cm
            </div>
          </div>
          <LineChart points={waist.map(w => ({ date: w.date, value: w.waist }))} unit="cm" height={90} />
        </div>
      )}

      {drops.length > 0 && (
        <div className="mx-alert">
          <div className="mx-eyebrow">Revisa la pérdida de fuerza</div>
          <p>Bajar peso no debería hundir tus cargas. Estos ejercicios necesitan atención:</p>
          {drops.slice(0, 4).map(drop => (
            <div key={drop.name} className="mx-drop">
              <span>{drop.name}</span>
              <span className="mx-mono">{drop.from} → {drop.to} kg</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
