// Code node "Preparar mensaje" del workflow "Sistema Push" (n8n XI555krGiKbDvH4F).
// Se pega tal cual en el nodo. Vive aqui como respaldo y para poder probarlo.
const input = $input.first().json;
const body = input.body && typeof input.body === 'object' ? input.body : {};
if (typeof body.title === 'string' || typeof body.body === 'string') {
  return [{ json: { title: body.title || 'Traza', body: body.body || '' } }];
}

let state;
try { state = JSON.parse(input.data || '{}'); } catch { return []; }
if (!state || !Array.isArray(state.records)) return [];

const now = new Date();
const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', hour: '2-digit', hour12: false }).format(now)) % 24;
const dateAt = offset => {
  const d = new Date(now.getTime() + offset * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = type => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const fmt = (n, d = 1) => n.toFixed(d).replace('.', ',');
const today = dateAt(0);

// Meta mas proxima que no haya pasado.
const goals = state.settings && Array.isArray(state.settings.goals) ? state.settings.goals : [];
const goal = goals
  .filter(g => g && typeof g.date === 'string' && g.date >= today && typeof g.targetWeight === 'number')
  .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
if (!goal) return [];
const daysLeft = dayNum(goal.date) - dayNum(today);

const weights = state.records
  .filter(r => r && typeof r.weight === 'number' && r.weight > 0 && r.date <= today)
  .sort((a, b) => (a.date < b.date ? -1 : 1));
const last = weights.length ? weights[weights.length - 1] : null;
const weighedToday = !!last && last.date === today;

// Ritmo real: promedio de 7 dias contra los 7 anteriores (kg/sem, negativo = bajando).
const avg = (from, to) => {
  const v = weights.filter(r => r.date >= from && r.date <= to).map(r => r.weight);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const recent = avg(dateAt(-6), today);
const prev = avg(dateAt(-13), dateAt(-7));
const perWeek = recent != null && prev != null ? recent - prev : null;

// 20:00: solo si hoy no te pesaste.
if (hour === 20) {
  if (weighedToday) return [];
  return [{ json: {
    title: 'Hoy no te pesaste',
    body: `Quedan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} para ${goal.name}. Sin pesaje no sabes dónde estás parado.`,
  } }];
}
if (hour !== 8) return [];

// 08:00: la cuenta regresiva.
const title = daysLeft === 0 ? `Hoy es ${goal.name}`
  : daysLeft === 1 ? `Mañana es ${goal.name}`
  : `Quedan ${daysLeft} días · ${goal.name}`;

const tagline = daysLeft === 0 ? 'Se acabó la preparación. Hoy se ve lo que hiciste.'
  : daysLeft === 1 ? 'Último día para ajustar. Todo lo de hoy cuenta.'
  : [
      `Mañana serán ${daysLeft - 1}. Hoy no se repite.`,
      `Si hoy la cagas, es un día menos y no se devuelve. Quedarán ${daysLeft - 1}.`,
      `Cada día que pasa no vuelve. Mañana: ${daysLeft - 1}.`,
    ][dayNum(today) % 3];

let weightLine;
if (!last) {
  weightLine = 'Todavía no tienes ningún pesaje. Pésate hoy.';
} else {
  const remaining = last.weight - goal.targetWeight;
  if (remaining <= 0) {
    weightLine = `Estás en ${fmt(last.weight)} kg y la meta es ${fmt(goal.targetWeight)}. Ya llegaste: no lo sueltes.`;
  } else if (daysLeft === 0) {
    weightLine = `Estás en ${fmt(last.weight)} kg, la meta era ${fmt(goal.targetWeight)}.`;
  } else {
    const need = remaining / (daysLeft / 7);
    weightLine = `Estás en ${fmt(last.weight)} kg y te faltan ${fmt(remaining)}. Necesitas bajar ${fmt(need, 2)} kg/sem`
      + (perWeek != null ? (perWeek < 0 ? `; vas a ${fmt(-perWeek)}.` : '; tu peso no está bajando.') : '.');
  }
  const stale = dayNum(today) - dayNum(last.date);
  if (stale >= 3) weightLine += ` Último pesaje hace ${stale} días.`;
  else if (!weighedToday) weightLine += ' Pésate hoy.';
}

return [{ json: { title, body: `${tagline} ${weightLine}` } }];
