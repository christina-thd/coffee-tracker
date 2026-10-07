const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago, short: "now", "5m", "3h", "2d", "3w", then the date ("12 Mar"). */
export function ago(time, now = Date.now()) {
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return 'now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < 8 * 7 * DAY) return `${Math.floor(elapsed / (7 * DAY))}w`;
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** How long ago, in a sentence: "just now", "2h ago", "on 12 Mar". */
export function agoText(time, now = Date.now()) {
  const short = ago(time, now);
  if (short === 'now') return 'just now';
  return /\d[mhdw]$/.test(short) ? `${short} ago` : `on ${short}`;
}

/** The time of day, "08:42". */
export const clock = (time) => new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** A full date and time, for the brew sheet. */
export const dateTime = (time) => new Date(time).toLocaleString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** The day of a time, "3 Oct". */
export const dayMonth = (time) => new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** A calendar day ('YYYY-MM-DD'), "3 Oct". */
export const shortDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The heading of a day's brews: "Today", "Yesterday", "Mon 6 Oct". */
export function dayLabel(time, now = Date.now()) {
  const day = new Date(time).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  if (day === today) return 'Today';
  if (today - day <= DAY + HOUR && today > day) return 'Yesterday';   // + an hour: the day daylight saving changes
  return new Date(time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Days since a calendar day ('YYYY-MM-DD'), 0 or more. */
export const daysSince = (date, now = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(`${date}T00:00:00`).getTime()) / DAY));

/** "1 brew", "3 brews". */
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A price with the currency: "€14.50", "€14". */
export function money(value, currency) {
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${currency}${amount}`;
}

/** A number without trailing zeros: 18, 18.5. */
export const num = (value) => String(Math.round(value * 100) / 100);
