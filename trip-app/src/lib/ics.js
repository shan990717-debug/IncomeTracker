/* Calendar export (.ics): the dependable way to get reminders on a phone without a push server. */

const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);
const ymd = (d) => d.replace(/-/g, '');

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

/** Prep tasks as all-day events with a 9:00 alarm, so the phone calendar reminds you. */
export function buildICS({ trip, tasks }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TripPlanner//CN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(trip.name)} 出发准备`];
  for (const t of tasks) {
    if (t.done || !t.dueDate) continue;
    L.push(
      'BEGIN:VEVENT', `UID:${t.id}@trip-task`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(t.dueDate)}`,
      `SUMMARY:${esc('☑️ ' + t.title)}`,
    );
    const desc = [t.note, t.link, t.sourceUrl && `来源：${t.sourceUrl}`].filter(Boolean).join('\n');
    if (desc) L.push(`DESCRIPTION:${esc(desc)}`);
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
