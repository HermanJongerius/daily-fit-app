// Gedeelde helpers voor de gewricht-weekcyclus en datum-opmaak.
// Vaste kalendercyclus, zoals besloten: ma=Nek, di=Schouders, wo=Ellebogen, do=Rug, vr=Heup, za=Knie, zo=Enkels.
export const JOINTS_BY_WEEKDAY = ['Enkels', 'Nek', 'Schouders', 'Ellebogen', 'Rug', 'Heup', 'Knie']; // 0=zo..6=za (JS getDay())

export function jointForDate(d) {
  return JOINTS_BY_WEEKDAY[d.getDay()];
}

export function isoDateLocal(d) {
  const t = new Date(d);
  t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
  return t.toISOString().slice(0, 10);
}

export function todayIso() {
  return isoDateLocal(new Date());
}

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function fmtDateLong(iso) {
  if (!iso) return '';
  const isoStr = typeof iso === 'string' ? iso : isoDateLocal(iso);
  const [y, m, d] = isoStr.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
