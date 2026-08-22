import { useMemo } from 'react'
import type { AppController } from '../hooks/useAppState'
import {
  addDays, adherence, getRecord, getVerdict, hasFoodLog, kcal,
  lastNDates, macrosForDate, shortDate, sleepHours, strengthDrops, sumMacrosOver,
  waistSeries, weekDates, weekPace, weightAvg, weightProjection, weightTrend,
} from '../lib/logic'
import { MACRO_LABEL, RULES, VERDICT_TEXT } from '../lib/config'
import { DayBars, LineChart, PaceBar, Stat } from '../components/charts'

export function WeekScreen({ app }: { app: AppController }) {
  const { state, today } = app
  const { targets, split } = state.settings
  const records = state.records

  const week = useMemo(() => weekDates(today), [today])
  const pace = weekPace(week, today)

  const verdict = getVerdict(records, state.settings)
  const V = VERDICT_TEXT[verdict] ?? VERDICT_TEXT.ok

  const weekTotals = useMemo(() => sumMacrosOver(records, week), [records, week])
  const weekTarget = { prot: targets.prot * 7, carb: targets.carb * 7, grasa: targets.grasa * 7 }

  const adh = useMemo(() => adherence(records, week, state.settings), [records, week, state.settings])

  const macroByDay = useMemo(
    () => week.map(d => (hasFoodLog(getRecord(records, d)) ? macrosForDate(records, d) : null)),
    [records, week],
  )

  // Peso: 30 dias con hueco explicito donde no hubo registro.
  const weightPoints = useMemo(() => {
    const dates = lastNDates(RULES.weightChartDays, today)
    return dates.map(d => ({ date: d, value: getRecord(records, d)?.weight ?? null }))
  }, [records, today])
  const avg7 = weightAvg(records, addDays(today, -6), today)
  const trend = weightTrend(records)

  const stepsByDay = week.map(d => getRecord(records, d)?.steps ?? null)
  const stepsAvg = (() => {
    const v = stepsByDay.filter((x): x is number => x !== null)
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
  })()

  const sleepByDay = week.map(d => {
    const r = getRecord(records, d)
    return sleepHours(r?.bedTime, r?.wakeTime)
  })

  const waist = useMemo(() => waistSeries(records, 90), [records])
  const drops = useMemo(() => strengthDrops(records, split), [records, split])
  const projection = weightProjection(records, state.settings)

  if (records.length === 0) {
    return (
      <div className="mx-card">
        <div className="mx-eyebrow">{VERDICT_TEXT.welcome.title}</div>
        <div className="mx-sub" style={{ marginTop: 8, lineHeight: 1.55 }}>
          {VERDICT_TEXT.welcome.note}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mx-verdict" data-s={verdict}>
        <div>
          <div className="mx-eyebrow">Esta semana</div>
          <div className="mx-verdict-h">{V.title}</div>
        </div>
        <div className="mx-verdict-n">{V.note}</div>
      </div>

      {/* --- Meta de peso --- */}
      {(() => {
        const s = state.settings
        const hasGoal = s.targetWeight != null && s.targetDate
        if (!hasGoal) return null
        if (!projection) {
          return (
            <div className="mx-card">
              <div className="mx-card-t">
                <div className="mx-eyebrow">Meta: {s.targetWeight} kg · {s.targetDate ? shortDate(s.targetDate) : ''}</div>
              </div>
              <div className="mx-empty">
                Sin tendencia de peso todavia. Pesate unos dias seguidos y la semana te dira
                si vas a llegar al ritmo actual.
              </div>
            </div>
          )
        }
        const onTrack = projection.gap >= 0
        return (
          <div className="mx-card">
            <div className="mx-card-t">
              <div className="mx-eyebrow">Meta · {shortDate(projection.targetDate)}</div>
              <div className="mx-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                {s.targetWeight} kg
              </div>
            </div>
            <div className="mx-meta" data-on={onTrack ? '1' : '0'}>
              <span className="mx-meta-v mx-mono">{projection.projected} kg</span>
              <span className="mx-meta-t">
                {onTrack
                  ? `Al ritmo actual (${Math.abs(projection.perWeek).toFixed(1)} kg/sem) llegarias a ${projection.projected} kg para el ${shortDate(projection.targetDate)}. Te sobran ${projection.gap.toFixed(1)} kg de margen.`
                  : `Al ritmo actual (${Math.abs(projection.perWeek).toFixed(1)} kg/sem) llegarias a ${projection.projected} kg para el ${shortDate(projection.targetDate)}. Quedan ${Math.abs(projection.gap).toFixed(1)} kg por bajar.`}
              </span>
            </div>
          </div>
        )
      })()}

      {/* --- Cifras --- */}
      <div className="mx-three">
        <Stat
          label="Registrados"
          value={`${adh.logged}`}
          unit="/7"
          sub="dias con comida"
        />
        <Stat
          label="En objetivo"
          value={`${adh.onTarget}`}
          unit={`/${adh.logged || 0}`}
          sub={`dentro de ±${Math.round(state.settings.tolerance * 100)}%`}
          tone={adh.logged > 0 && adh.onTarget >= adh.logged * RULES.onTargetShare ? 'good' : 'warn'}
        />
        <Stat
          label="Peso 7d"
          value={trend ? `${trend.delta > 0 ? '+' : ''}${trend.delta.toFixed(1)}` : '—'}
          unit={trend ? 'kg' : undefined}
          sub="vs semana previa"
          tone={trend ? (trend.delta < 0 ? 'good' : 'warn') : 'mute'}
        />
      </div>

      {/* --- Acumulado semanal: el numero que decide --- */}
      <div className="mx-card">
        <div className="mx-card-t">
          <div className="mx-eyebrow">Acumulado de la semana</div>
          <div className="mx-mono" style={{ fontSize: 11, color: 'var(--mute)' }}>
            {Math.round(pace * 7)} de 7 dias
          </div>
        </div>
        <PaceBar label={MACRO_LABEL.prot} value={weekTotals.prot} target={weekTarget.prot} pace={pace} />
        <PaceBar label={MACRO_LABEL.carb} value={weekTotals.carb} target={weekTarget.carb} pace={pace} />
        <PaceBar label={MACRO_LABEL.grasa} value={weekTotals.grasa} target={weekTarget.grasa} pace={pace} />
        <div className="mx-legend">
          La marca vertical es donde deberias ir hoy. {kcal(weekTotals)} kcal acumuladas.
        </div>
      </div>

      {/* --- Macros dia a dia --- */}
      <div className="mx-card">
        <div className="mx-card-t"><div className="mx-eyebrow">Macros por dia</div></div>
        {(['prot', 'carb', 'grasa'] as const).map(k => (
          <div key={k} className="mx-chartblock">
            <div className="mx-chartblock-h">
              <span className="mx-lbl">{MACRO_LABEL[k]}</span>
              <span className="mx-mono mx-sub">objetivo {targets[k]} g</span>
            </div>
            <DayBars
              dates={week}
              values={macroByDay.map(m => (m ? Math.round(m[k]) : null))}
              target={targets[k]}
              unit="g"
              tone={k}
            />
          </div>
        ))}
        <div className="mx-legend">Las barras huecas son dias sin registrar, no dias en cero.</div>
      </div>

      {/* --- Peso --- */}
      <div className="mx-card">
        <div className="mx-card-t">
          <div className="mx-eyebrow">Peso · {RULES.weightChartDays} dias</div>
          <div className="mx-mono" style={{ fontSize: 12, fontWeight: 600 }}>
            {avg7 !== null ? `${avg7.toFixed(1)} kg` : '—'}
          </div>
        </div>
        <LineChart points={weightPoints} unit="kg" band={avg7} height={110} />
        <div className="mx-legend">La linea horizontal es tu media de los ultimos 7 dias.</div>
      </div>

      {/* --- Pasos --- */}
      <div className="mx-card">
        <div className="mx-card-t">
          <div className="mx-eyebrow">Pasos</div>
          <div className="mx-mono" style={{ fontSize: 12, fontWeight: 600 }}>
            {stepsAvg !== null ? `${stepsAvg.toLocaleString('es-PE')} prom` : '—'}
          </div>
        </div>
        <DayBars dates={week} values={stepsByDay} />
      </div>

      {/* --- Sueno --- */}
      <div className="mx-card">
        <div className="mx-card-t"><div className="mx-eyebrow">Sueno</div></div>
        <DayBars dates={week} values={sleepByDay} target={state.settings.sleepTarget} unit="h" />
      </div>

      {/* --- Cintura --- */}
      {waist.length >= 2 && (
        <div className="mx-card">
          <div className="mx-card-t">
            <div className="mx-eyebrow">Cintura</div>
            <div className="mx-mono" style={{ fontSize: 12, fontWeight: 600 }}>
              {waist[waist.length - 1].waist} cm
            </div>
          </div>
          <LineChart
            points={waist.map(w => ({ date: w.date, value: w.waist }))}
            unit="cm"
            height={90}
          />
        </div>
      )}

      {/* --- Fuerza --- */}
      {drops.length > 0 && (
        <div className="mx-alert">
          <div className="mx-eyebrow">Bajaste de peso en</div>
          {drops.slice(0, 4).map(d => (
            <div key={d.name} className="mx-drop">
              <span>{d.name}</span>
              <span className="mx-mono">{d.from} → {d.to} kg</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
