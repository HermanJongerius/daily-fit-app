import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Gedeelde helpers voor de gewricht-weekcyclus en datum-opmaak.
// Vaste kalendercyclus, zoals besloten: ma=Nek, di=Schouders, wo=Ellebogen, do=Rug, vr=Heup, za=Knie, zo=Enkels.
export const JOINTS_BY_WEEKDAY = ['Enkels', 'Nek', 'Schouders', 'Ellebogen', 'Rug', 'Heup', 'Knie']; // 0=zo..6=za (JS getDay())

// Alle "welke dag is het vandaag"-berekeningen in de app gaan uit van de Nederlandse klok
// (Europe/Amsterdam), NIET van de tijdzone waarin de server zelf draait. Railway (en deze
// ontwikkelomgeving) draait standaard op UTC, en Nederland loopt daar het hele jaar 1 of 2 uur
// op voor (CET/CEST). Zonder deze correctie zou een training die vlak na Nederlandse middernacht
// wordt gedaan (bijv. 00:30 's nachts) door de server nog als "gisteren" geregistreerd worden,
// omdat het in UTC op dat moment nog niet middernacht is — met als zichtbaar gevolg dat het
// verkeerde dagbolletje oplicht op het scherm "Vandaag".
const APP_TIMEZONE = 'Europe/Amsterdam';

// Versienummer rechtstreeks uit package.json gelezen (één bron van waarheid, altijd gelijk
// aan wat er in package.json/README.md staat) — wordt onderaan elke pagina getoond, zodat
// altijd te zien is naar welke versie (test of live) je op dat moment kijkt.
const __dirname = dirname(fileURLToPath(import.meta.url));
export const APP_VERSION = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version;

// Eerste letter van elke dag, voor de week-voortgangsbolletjes (ma=M, di=D, wo=W, do=D, vr=V, za=Z, zo=Z).
export const DAY_LETTERS_BY_WEEKDAY = ['Z', 'M', 'D', 'W', 'D', 'V', 'Z']; // 0=zo..6=za (JS getDay())

export function jointForDate(d) {
  return JOINTS_BY_WEEKDAY[weekdayInAppTz(d)];
}

// Geeft de kalenderdatum (YYYY-MM-DD) van een moment terug zoals die is in Nederlandse tijd,
// ongeacht de tijdzone van de server zelf. Zie toelichting bij APP_TIMEZONE hierboven.
export function isoDateLocal(d) {
  const date = d instanceof Date ? d : new Date(d);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Weekdag (0=zo..6=za, zoals JS' eigen getDay()) van een moment, in Nederlandse tijd.
export function weekdayInAppTz(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
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

// Persoonlijke 7-daagse trainingscyclus, voor het "onthullingsscherm" na de oefening.
// De cyclus start op de dag dat het account is aangemaakt (created_at) en loopt daarna
// steeds door in blokken van 7 kalenderdagen — onafhankelijk van maandag/zondag, en
// onafhankelijk per deelnemer (iedereen heeft zijn eigen start- en cyclusdagen).
// Geeft terug: dayInCycle (1 t/m 7, dag 7 = laatste dag van de cyclus) en de
// begin-/einddatum (iso-strings) van de cyclus waar "todayIsoStr" in valt.
export function cycleInfoForUser(createdAt, todayIsoStr) {
  const anchorIso = isoDateLocal(createdAt);
  const anchor = new Date(anchorIso + 'T00:00:00');
  const today = new Date(todayIsoStr + 'T00:00:00');
  const daysSinceAnchor = Math.max(0, Math.round((today - anchor) / 86400000));
  const dayInCycle = (daysSinceAnchor % 7) + 1; // 1..7
  const cycleStart = new Date(anchor.getTime() + (daysSinceAnchor - (dayInCycle - 1)) * 86400000);
  const cycleEnd = new Date(cycleStart.getTime() + 6 * 86400000);
  return { dayInCycle, cycleStartIso: isoDateLocal(cycleStart), cycleEndIso: isoDateLocal(cycleEnd) };
}

// Aantal dagen dat een deelnemer had kúnnen trainen: vanaf de dag van aanmelden
// (created_at) tot en met vandaag. Gebruikt voor het trainingspercentage in het
// beheerdersoverzicht ("X keer getraind van de Y mogelijke dagen").
export function daysPossibleSince(createdAt, todayIsoStr) {
  const anchorIso = isoDateLocal(createdAt);
  const anchor = new Date(anchorIso + 'T00:00:00');
  const today = new Date(todayIsoStr + 'T00:00:00');
  const days = Math.max(0, Math.round((today - anchor) / 86400000));
  return days + 1; // inclusief vandaag
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
