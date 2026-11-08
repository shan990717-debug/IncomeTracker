import { hasCoords } from './geo';
import { md, weekday, shiftDate } from './dates';

/*
 * 订单 (flights, hotels, trains) and what they mean for a day's plan:
 *   - hotel: the night's base — where the day starts and ends
 *   - flight landing on the first day: the day starts at the airport
 *   - flight leaving on the last day: the day ends at the airport, 3 h before
 *   - any other train / flight: a fixed slot in the day (KTX 10:30)
 * Bookings for everyone apply to all; a personal one only to its owner.
 */

export const KINDS = {
  flight: { emoji: '✈️', label: '机票', bg: 'bg-sky-100 dark:bg-sky-500/20' },
  hotel: { emoji: '🏨', label: '酒店', bg: 'bg-violet-100 dark:bg-violet-500/20' },
  train: { emoji: '🚄', label: '车票', bg: 'bg-orange-100 dark:bg-orange-500/20' },
  other: { emoji: '🎫', label: '其他', bg: 'bg-muted' },
};
export const kindOf = (k) => KINDS[k] || KINDS.other;

export const ofTripBookings = (state, trip) => (state.bookings || [])
  .filter((b) => b.tripId === trip.id)
  .sort((a, b) => `${a.startDate || '9'}${a.startTime}`.localeCompare(`${b.startDate || '9'}${b.startTime}`));

/** Bookings that apply to me (everyone's, or my own). */
export const myBookings = (state, trip) => {
  const me = state.user?.id || 'local';
  return ofTripBookings(state, trip).filter((b) => b.forAll || !b.ownerId || b.ownerId === me);
};

const addMin = (hhmm, n) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const t = Math.max(0, Math.min(23 * 60 + 59, h * 60 + (m || 0) + n));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const minutesBetween = (a, b) => {
  const [h1, m1] = String(a).split(':').map(Number);
  const [h2, m2] = String(b).split(':').map(Number);
  if (![h1, h2].every(Number.isFinite)) return 120;
  const d = h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0));
  return d > 0 ? d : d + 24 * 60;
};

const hotelPoint = (h, label) => (h?.place ? { ...h.place, name: h.place.name || h.title, label, bookingId: h.id } : null);

/** What the bookings say about one day. */
export function bookingsForDay(state, trip, day) {
  const list = myBookings(state, trip);
  const hotels = list.filter((b) => b.kind === 'hotel' && b.startDate);
  const out = (h) => h.endDate || shiftDate(h.startDate, 1);
  const wokeUpAt = hotels.find((h) => h.startDate < day && out(h) >= day); // checked in earlier
  const sleepAt = hotels.find((h) => h.startDate <= day && out(h) > day); // tonight
  const moves = list.filter((b) => (b.kind === 'flight' || b.kind === 'train') && b.startDate);
  const first = trip.startDate && day === trip.startDate;
  const last = trip.endDate && day === trip.endDate;
  const arrival = first ? moves.find((b) => b.kind === 'flight' && (b.endDate || b.startDate) === day) : null;
  const departure = last ? moves.find((b) => b.kind === 'flight' && b.startDate === day && b !== arrival) : null;
  const fixed = moves
    .filter((b) => b.startDate === day && b !== arrival && b !== departure && b.startTime)
    .map((b) => ({
      id: `bk-${b.id}`,
      bookingId: b.id,
      fixed: b.startTime,
      ready: b.kind === 'flight' ? 90 : 20, // be at the airport / station this many minutes early
      stay: b.endTime ? minutesBetween(b.startTime, b.endTime) : 120,
      title: `${b.number ? `${b.number} ` : ''}${b.from?.name || ''} → ${b.to?.name || ''}`.trim(),
      kind: b.kind,
      seats: b.seats,
      endTime: b.endTime,
      name: b.from?.name || '',
      ...(hasCoords(b.from) ? { lat: b.from.lat, lng: b.from.lng } : {}),
      after: b.to ? { ...b.to } : null,
    }))
    .sort((a, b) => a.fixed.localeCompare(b.fixed));
  return {
    arrival, departure, fixed, wokeUpAt, sleepAt,
    // Where the bookings put the day's start / end, if anywhere.
    start: arrival?.to ? { ...arrival.to, label: `${arrival.number || '航班'} 落地` }
      : wokeUpAt ? hotelPoint(wokeUpAt, out(wokeUpAt) === day ? '退房' : '')
        : sleepAt ? hotelPoint(sleepAt, '') : null,
    startTime: arrival?.endTime ? addMin(arrival.endTime, 60) : '',
    end: departure?.from ? { ...departure.from, label: `${departure.number || '航班'} 起飞` }
      : sleepAt ? hotelPoint(sleepAt, sleepAt !== wokeUpAt ? '入住' : '') : null,
    endTime: departure?.startTime ? addMin(departure.startTime, -180) : '',
  };
}

/** Short line for a booking card. */
export function bookingWhen(b) {
  const d = (x) => (x ? `${md(x)} ${weekday(x)}` : '');
  if (b.kind === 'hotel') return `${b.startDate ? md(b.startDate) : '?'} – ${b.endDate ? md(b.endDate) : '?'}`;
  if (!b.startDate) return '';
  return `${d(b.startDate)} ${b.startTime}${b.endTime ? ` → ${b.endDate && b.endDate !== b.startDate ? `${md(b.endDate)} ` : ''}${b.endTime}` : ''}`;
}

export const nights = (b) => (b.startDate && b.endDate
  ? Math.max(0, Math.round((Date.parse(b.endDate) - Date.parse(b.startDate)) / 864e5)) : 0);

export function bookingTitle(b) {
  if (b.kind === 'hotel') return b.title || b.place?.name || '酒店';
  const route = b.from?.name || b.to?.name ? `${b.from?.name || '?'} → ${b.to?.name || '?'}` : b.title;
  return [b.number, route].filter(Boolean).join(' ');
}

/** A 须知 like「KTX 提前一个月订」is taken care of once a matching booking exists. */
export function coveredByBooking(tip, bookings) {
  if (!tip.isAction) return null;
  const t = tip.title || '';
  const kind = /KTX|SRT|高铁|火车|车票|ITX|Korail/i.test(t) ? 'train' : /机票|航班|飞机/.test(t) ? 'flight' : /酒店|住宿|民宿|订房/.test(t) ? 'hotel' : '';
  return kind ? bookings.find((b) => b.kind === kind) || null : null;
}
