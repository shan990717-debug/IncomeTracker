import { toMinutes, fromMinutes } from './dates';

/*
 * Calendar export: the reliable way to get "当日提醒" on a phone without a
 * push server. Important stops get a VALARM; prep tasks become all-day events
 * with a 9:00 alarm. Times are floating (no timezone), i.e. they ring at the
 * written local time wherever the phone is — which is what you want abroad.
 */

const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);
const ymd = (d) => d.replace(/-/g, '');
const hm = (t) => t.replace(':', '') + '00';

function fold(line) {
  // RFC 5545: lines > 75 octets are folded. Chinese chars are 3 bytes, so fold by bytes.
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > 73) {
      out.push(cur);
      cur = ' ' + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

export function buildICS({ trip, items, tasks, statusOf }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TripPlanner//CN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(trip.name)}`];

  for (const it of items) {
    if (statusOf?.(it).done) continue;
    L.push('BEGIN:VEVENT', `UID:${it.id}@trip`, `DTSTAMP:${stamp}`);
    if (it.time) {
      const end = fromMinutes(Math.min(toMinutes(it.time) + 60, 23 * 60 + 59));
      L.push(`DTSTART:${ymd(it.date)}T${hm(it.time)}`, `DTEND:${ymd(it.date)}T${hm(end)}`);
    } else {
      L.push(`DTSTART;VALUE=DATE:${ymd(it.date)}`);
    }
    L.push(`SUMMARY:${esc((it.important ? '⭐ ' : '') + it.title)}`);
    const desc = [it.area, it.note].filter(Boolean).join('\n');
    if (desc) L.push(`DESCRIPTION:${esc(desc)}`);
    if (it.area || it.region) L.push(`LOCATION:${esc([it.area, it.region].filter(Boolean).join(', '))}`);
    if (it.important && it.time) {
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(it.title)}`, `TRIGGER:-PT${it.remindMin || 30}M`, 'END:VALARM');
    }
    L.push('END:VEVENT');
  }

  for (const t of tasks) {
    if (t.done || !t.dueDate) continue;
    L.push(
      'BEGIN:VEVENT', `UID:${t.id}@trip-task`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(t.dueDate)}`,
      `SUMMARY:${esc('☑️ ' + t.title)}`,
    );
    if (t.note || t.link) L.push(`DESCRIPTION:${esc([t.note, t.link].filter(Boolean).join('\n'))}`);
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(t.title)}`, 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
  }

  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n');
}

export function download(filename, text, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
