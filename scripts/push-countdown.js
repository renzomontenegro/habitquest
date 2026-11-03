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

const dd = `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`;
const next = daysLeft > 1 ? `Mañana serán ${daysLeft - 1}` : 'Mañana es el día';
const pick = list => list[((dayNum(today) % list.length) + list.length) % list.length];

// 20:00: solo si hoy no te pesaste. Siempre discreto: sin evento ni cifras.
if (hour === 20) {
  if (weighedToday) return [];
  const [t, b] = pick([
    ['Falta tu pesaje', 'Hoy no te pesaste. Sin dato no sabes dónde estás parado.'],
    [dd, 'Hoy no te pesaste. El día se acaba y no se repite.'],
    ['Pesaje pendiente', 'Mañana en ayunas, lo primero. Sin dato no hay ajuste.'],
  ]);
  return [{ json: { title: t, body: b } }];
}
if (hour !== 8) return [];

// 08:00: el mensaje del dia. Cada mensaje es "directo" (nombra el evento y las
// cifras) o "discreto" (nada que se entienda si alguien ve la pantalla). Se
// alternan por dia para que no sea siempre el mismo tono.
const stale = last ? dayNum(today) - dayNum(last.date) : null;
const remaining = last ? last.weight - goal.targetWeight : null;
const need = remaining != null && remaining > 0 && daysLeft > 0 ? remaining / (daysLeft / 7) : null;
const lose = perWeek != null ? -perWeek : null; // kg/sem que realmente estas bajando

let situation;
if (!last) situation = 'nodata';
else if (stale >= 3) situation = 'stale';
else if (remaining <= 0) situation = 'reached';
else if (daysLeft === 0) situation = 'dday';
else if (lose != null && (lose >= 0.4 || (need != null && lose >= need * 0.8))) situation = 'ontrack';
else situation = 'behind';

const w = last ? fmt(last.weight) : '';
const paceTxt = need == null ? ''
  : lose == null ? `Necesitas bajar ${fmt(need, 2)} kg/sem.`
  : lose > 0 ? `Necesitas ${fmt(need, 2)} kg/sem y vas a ${fmt(lose)}.`
  : `Necesitas ${fmt(need, 2)} kg/sem y tu peso no está bajando.`;

const pools = {
  nodata: () => [
    [`Quedan ${dd} · ${goal.name}`, 'Sin pesaje no sabes dónde estás parado. Pésate hoy.'],
    [dd, 'Pésate en ayunas hoy. Sin dato no hay plan.'],
    ['Carb cycling', 'Día de entreno: carbos arriba. Día de descanso: carbos abajo. Y pésate hoy.'],
  ],
  stale: () => [
    ['Pésate', `Último pesaje hace ${stale} días. Sin dato no hay cuenta.`],
    [`${dd} · ${goal.name}`, `Llevas ${stale} días sin pesarte. Pésate hoy y vemos dónde estás.`],
    [dd, `Hace ${stale} días que no te pesas. Mañana serán uno menos igual.`],
  ],
  reached: () => [
    ['Meta alcanzada', 'Ya estás en el peso. Mantén lo que haces y no lo sueltes.'],
    [goal.name, `Ya llegaste (${w} kg). Mantén el carb cycling igual hasta el día.`],
  ],
  dday: () => [
    [`Hoy es ${goal.name}`, 'Se acabó la preparación. Hoy se ve lo que hiciste.'],
    ['Hoy es el día', `Estás en ${w} kg, la meta era ${fmt(goal.targetWeight)}.`],
  ],
  ontrack: () => [
    ['Va bien', `Bajas ${fmt(lose)} kg/sem. Sigue así, no cambies nada de lo que haces.`],
    [`${dd} · ${goal.name}`, `Bajas ${fmt(lose)} kg/sem y estás en ${w} kg. Esto funciona: no lo toques.`],
    ['Constancia', 'Lo que haces está funcionando. No cambies el carb cycling ni nada: repite hoy.'],
    [dd, `${next} y vas en la dirección correcta. Sigue igual.`],
  ],
  behind: () => [
    [`Quedan ${dd} · ${goal.name}`, `${next}. Hoy no se repite. Estás en ${w} kg y te faltan ${fmt(remaining)}. ${paceTxt}`.trim()],
    [dd, 'Si hoy la cagas, es un día menos y no se devuelve.'],
    ['Carb cycling', 'Carbos altos solo si hoy entrenas; si descansas, bájalos. Sin ese contraste el peso no se mueve.'],
    ['Hoy decide', `Te faltan ${fmt(remaining)} kg y quedan ${dd}. Hoy decide si llegas o no. ${paceTxt}`.trim()],
    ['Un día menos', `${next}. Que los carbos de hoy sigan tu día: más si entrenas, menos si descansas.`],
    [goal.name, `Quedan ${dd}. ${paceTxt || 'Pésate y ajusta.'}`.trim()],
  ],
};

const [title, text] = pick(pools[situation]());
return [{ json: { title, body: text } }];
